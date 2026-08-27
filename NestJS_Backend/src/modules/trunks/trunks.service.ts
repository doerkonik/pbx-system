import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, Repository } from 'typeorm';
import {
  PsAor,
  PsAuth,
  PsEndpoint,
  PsEndpointIdIp,
  PsRegistration,
  Trunk,
} from '../../database/entities';
import { CreateTrunkDto, UpdateTrunkDto } from './dto/trunk.dto';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import { TrunkAuthType } from '../../common/enums';
import { assertSafeAsteriskId } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';
import { TelephonyService } from '../../telephony/telephony.service';

export interface TrunkWithStatus extends Trunk {
  registration: {
    presence: string;
    contactStatus: string;
    channel: string;
    updatedAt: string;
  } | null;
}

/** Resolved trunk configuration used to (re)write the PJSIP backing rows. */
interface TrunkConfig {
  name: string;
  authType: TrunkAuthType;
  sipServer: string;
  sipPort: number;
  username: string | null;
  password: string | null;
  matchIp: string | null;
  codecs: string;
}

/**
 * Owns SIP trunk lifecycle. Writes the PJSIP realtime rows Asterisk reads live
 * (ps_endpoints/ps_aors + ps_auths/ps_registrations for REGISTRATION trunks, or
 * ps_endpoint_id_ips for IP trunks) AND the app-level `trunks` row inside one
 * transaction, so admin-created trunks go live without an Asterisk restart.
 */
@Injectable()
export class TrunksService {
  private readonly logger = new Logger(TrunksService.name);

  constructor(
    @InjectRepository(Trunk)
    private readonly trunkRepo: Repository<Trunk>,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly telephony: TelephonyService,
  ) {}

  /**
   * Endpoints/auths/aors are read on-demand from realtime, but outbound
   * registrations (ps_registrations) are only established on a PJSIP reload.
   * Trigger one after any trunk change so registration-based trunks come up
   * without a manual CLI reload. Best-effort: never fails the request.
   */
  private async reloadPjsip(): Promise<void> {
    try {
      await this.telephony.rawAction({ Action: 'Command', Command: 'pjsip reload' });
      this.logger.log('Triggered pjsip reload after trunk change');
    } catch (err) {
      this.logger.warn(
        `pjsip reload after trunk change failed (non-fatal): ${(err as Error).message}`,
      );
    }
  }

  async create(dto: CreateTrunkDto): Promise<TrunkWithStatus> {
    const name = assertSafeAsteriskId(dto.name, 'name');

    const existing = await this.trunkRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Trunk ${name} already exists`);
    }

    const config = this.buildConfig(name, dto.authType, dto);
    this.assertConfig(config);

    const saved = await this.dataSource.transaction(async (mgr) => {
      await this.writeBackingRows(mgr, config);

      const trunk = mgr.getRepository(Trunk).create({
        name: config.name,
        authType: config.authType,
        sipServer: config.sipServer,
        sipPort: config.sipPort,
        username: config.username,
        password: config.password,
        matchIp: config.matchIp,
        codecs: config.codecs,
        failoverOrder: dto.failoverOrder ?? 0,
        isActive: dto.isActive ?? true,
      });
      return mgr.getRepository(Trunk).save(trunk);
    });

    this.logger.log(`Trunk ${name} created (authType=${config.authType})`);
    await this.reloadPjsip();
    return this.attachStatus(this.stripSecret(saved));
  }

  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<TrunkWithStatus>> {
    const { page, limit, search } = query;
    const [data, total] = await this.trunkRepo.findAndCount({
      where: search
        ? [
            { name: ILike(`%${search}%`) },
            { sipServer: ILike(`%${search}%`) },
          ]
        : {},
      order: { failoverOrder: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    // One AMI call for the whole page, then merge per-trunk.
    const regStatus = await this.telephony.getOutboundRegistrations();
    const withStatus = await Promise.all(
      data.map((t) => this.attachStatus(t, regStatus[t.name])),
    );
    return paginate(withStatus, total, page, limit);
  }

  async findOne(id: string): Promise<TrunkWithStatus> {
    const trunk = await this.trunkRepo.findOne({ where: { id } });
    if (!trunk) throw new NotFoundException('Trunk not found');
    const regStatus = await this.telephony.getOutboundRegistrations();
    return this.attachStatus(trunk, regStatus[trunk.name]);
  }

  async update(id: string, dto: UpdateTrunkDto): Promise<TrunkWithStatus> {
    // password is select:false — pull it so we can preserve it on rewrite.
    const trunk = await this.trunkRepo
      .createQueryBuilder('t')
      .addSelect('t.password')
      .where('t.id = :id', { id })
      .getOne();
    if (!trunk) throw new NotFoundException('Trunk not found');

    const newName = dto.name
      ? assertSafeAsteriskId(dto.name, 'name')
      : trunk.name;

    if (newName !== trunk.name) {
      const clash = await this.trunkRepo.findOne({ where: { name: newName } });
      if (clash) throw new ConflictException(`Trunk ${newName} already exists`);
    }

    const authType = dto.authType ?? trunk.authType;
    const config: TrunkConfig = {
      name: newName,
      authType,
      sipServer: dto.sipServer
        ? assertSafeAsteriskId(dto.sipServer, 'sipServer')
        : trunk.sipServer,
      sipPort: dto.sipPort ?? trunk.sipPort,
      username: dto.username !== undefined ? dto.username : trunk.username,
      password: dto.password !== undefined ? dto.password : trunk.password,
      matchIp: dto.matchIp !== undefined ? dto.matchIp : trunk.matchIp,
      codecs: dto.codecs ?? trunk.codecs ?? 'ulaw,alaw',
    };
    this.assertConfig(config);

    const saved = await this.dataSource.transaction(async (mgr) => {
      // Rewrite backing rows from scratch to stay consistent across authType /
      // name changes (removes stale ps_auths/ps_registrations/ps_endpoint_id_ips).
      await this.deleteBackingRows(mgr, trunk.name);
      if (newName !== trunk.name) {
        await this.deleteBackingRows(mgr, newName);
      }
      await this.writeBackingRows(mgr, config);

      await mgr.getRepository(Trunk).update(id, {
        name: config.name,
        authType: config.authType,
        sipServer: config.sipServer,
        sipPort: config.sipPort,
        username: config.username,
        password: config.password,
        matchIp: config.matchIp,
        codecs: config.codecs,
        failoverOrder: dto.failoverOrder ?? trunk.failoverOrder,
        isActive: dto.isActive ?? trunk.isActive,
      });
      return mgr.getRepository(Trunk).findOneByOrFail({ id });
    });

    this.logger.log(`Trunk ${config.name} updated`);
    await this.reloadPjsip();
    return this.attachStatus(this.stripSecret(saved));
  }

  async remove(id: string): Promise<void> {
    const trunk = await this.trunkRepo.findOne({ where: { id } });
    if (!trunk) throw new NotFoundException('Trunk not found');
    const name = trunk.name;

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(Trunk).delete(id);
      await this.deleteBackingRows(mgr, name);
    });
    this.logger.log(`Trunk ${name} deleted`);
    await this.reloadPjsip();
  }

  // ==========================================================================
  //  Backing-row management
  // ==========================================================================

  private buildConfig(
    name: string,
    authType: TrunkAuthType,
    dto: CreateTrunkDto | UpdateTrunkDto,
  ): TrunkConfig {
    return {
      name,
      authType,
      sipServer: assertSafeAsteriskId(dto.sipServer!, 'sipServer'),
      sipPort: dto.sipPort ?? 5060,
      username: dto.username ?? null,
      password: dto.password ?? null,
      matchIp: dto.matchIp ?? null,
      codecs: dto.codecs ?? 'ulaw,alaw',
    };
  }

  private assertConfig(cfg: TrunkConfig): void {
    if (cfg.authType === TrunkAuthType.REGISTRATION) {
      if (!cfg.username) {
        throw new BadRequestException(
          'username is required for a REGISTRATION trunk',
        );
      }
      if (!cfg.password) {
        throw new BadRequestException(
          'password is required for a REGISTRATION trunk',
        );
      }
    } else if (cfg.authType === TrunkAuthType.IP) {
      if (!cfg.matchIp) {
        throw new BadRequestException(
          'matchIp is required for an IP-auth trunk',
        );
      }
    }
  }

  /**
   * Writes every PJSIP realtime row a trunk needs. Both auth types get an
   * endpoint + AOR pointing at the provider; REGISTRATION adds an auth +
   * outbound registration, IP adds an identify (ps_endpoint_id_ips) row.
   */
  private async writeBackingRows(
    mgr: EntityManager,
    cfg: TrunkConfig,
  ): Promise<void> {
    const contact = `sip:${cfg.sipServer}:${cfg.sipPort}`;
    const registration = cfg.authType === TrunkAuthType.REGISTRATION;

    await mgr.getRepository(PsAor).save({
      id: cfg.name,
      contact,
      max_contacts: 1,
      remove_existing: 'yes',
      qualify_frequency: 60,
    });

    await mgr.getRepository(PsEndpoint).save({
      id: cfg.name,
      transport: 'transport-udp',
      aors: cfg.name,
      // `outbound_auth` answers the provider's challenge on our REGISTER and
      // on INVITEs we place. `auth` is deliberately NOT set: in PJSIP it makes
      // Asterisk challenge the provider's *inbound* INVITEs with a 401, which
      // carriers never answer — they authenticate to us by source IP via
      // ps_endpoint_id_ips. Setting it silently kills every incoming call.
      auth: null,
      outbound_auth: registration ? cfg.name : null,
      context: 'from-trunk',
      allow: cfg.codecs,
      disallow: '!all',
      direct_media: 'no',
      rtp_symmetric: 'yes',
      force_rport: 'yes',
      rewrite_contact: 'yes',
    });

    if (registration) {
      await mgr.getRepository(PsAuth).save({
        id: cfg.name,
        auth_type: 'userpass',
        username: cfg.username,
        password: cfg.password,
      });

      await mgr.getRepository(PsRegistration).save({
        id: cfg.name,
        transport: 'transport-udp',
        server_uri: `sip:${cfg.sipServer}`,
        client_uri: `sip:${cfg.username}@${cfg.sipServer}`,
        outbound_auth: cfg.name,
        endpoint: cfg.name,
        // Asterisk rejects the whole registration object if `endpoint` is set
        // without line support, so the trunk never registers at all.
        line: 'yes',
      });
    } else {
      await mgr.getRepository(PsEndpointIdIp).save({
        id: cfg.name,
        endpoint: cfg.name,
        match: cfg.matchIp!,
      });
    }
  }

  private async deleteBackingRows(
    mgr: EntityManager,
    name: string,
  ): Promise<void> {
    await mgr.getRepository(PsRegistration).delete(name);
    await mgr.getRepository(PsEndpointIdIp).delete(name);
    await mgr.getRepository(PsEndpoint).delete(name);
    await mgr.getRepository(PsAuth).delete(name);
    await mgr.getRepository(PsAor).delete(name);
  }

  // ==========================================================================
  //  Live status
  // ==========================================================================

  private async attachStatus(
    trunk: Trunk,
    liveRegStatus?: string,
  ): Promise<TrunkWithStatus> {
    let registration: TrunkWithStatus['registration'] = null;

    // Preferred: live outbound-registration status from Asterisk (via AMI).
    if (liveRegStatus) {
      registration = {
        presence: liveRegStatus === 'Registered' ? 'idle' : 'offline',
        contactStatus: liveRegStatus,
        channel: '',
        updatedAt: new Date().toISOString(),
      };
    } else {
      // No outbound registration for this trunk: either it is IP-authenticated
      // and never registers, or Asterisk refused to load the object. Qualify
      // reachability is then the only real health signal — without it the UI
      // has nothing to show and falls back to the literal label "Unknown".
      const contact = await this.telephony.getContactStatus(trunk.name);
      if (contact) {
        const reachable =
          contact.status === 'Reachable' || contact.status === 'Avail';
        registration = {
          presence: reachable ? 'idle' : 'offline',
          contactStatus: contact.rttMs
            ? `${contact.status} (${contact.rttMs} ms)`
            : contact.status,
          channel: '',
          updatedAt: new Date().toISOString(),
        };
      }
    }

    if (!registration) {
      // Last resort: any endpoint state we may have cached in Redis.
      try {
        const raw = await this.redis.client.hgetall(
          KEYS.endpointState(trunk.name),
        );
        if (raw && Object.keys(raw).length > 0) {
          registration = {
            presence: raw.presence ?? 'offline',
            contactStatus: raw.contactStatus ?? '',
            channel: raw.channel ?? '',
            updatedAt: raw.updatedAt ?? '',
          };
        }
      } catch (err) {
        this.logger.warn(
          `Could not read live state for trunk ${trunk.name}: ${(err as Error).message}`,
        );
      }
    }
    return { ...trunk, registration };
  }

  /** Never surface the SIP secret in API responses. */
  private stripSecret(trunk: Trunk): Trunk {
    const { password: _password, ...rest } = trunk;
    return rest as Trunk;
  }
}
