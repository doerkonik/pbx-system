import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  Extension,
  PsAor,
  PsAuth,
  PsEndpoint,
} from '../../database/entities';
import { CreateExtensionDto, UpdateExtensionDto } from './dto/extension.dto';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import {
  assertSafeAsteriskId,
  sanitizeText,
} from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

export interface ExtensionWithStatus extends Extension {
  registration: {
    presence: string;
    contactStatus: string;
    channel: string;
    updatedAt: string;
  } | null;
}

/**
 * Owns extension lifecycle. Writes the three PJSIP realtime rows Asterisk reads
 * live (ps_endpoints/ps_auths/ps_aors) AND the app-level `extensions` row inside
 * one transaction, so admin-created endpoints go live without an Asterisk restart.
 */
@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name);

  constructor(
    @InjectRepository(Extension)
    private readonly extRepo: Repository<Extension>,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateExtensionDto): Promise<Extension> {
    const id = assertSafeAsteriskId(dto.extensionNumber, 'extensionNumber');

    const existing = await this.extRepo.findOne({
      where: { extensionNumber: id },
    });
    if (existing) {
      throw new ConflictException(`Extension ${id} already exists`);
    }

    return this.dataSource.transaction(async (mgr) => {
      const webrtc = dto.webrtc ?? false;

      await mgr.getRepository(PsAor).save({
        id,
        max_contacts: webrtc ? 5 : 1,
        remove_existing: 'yes',
        qualify_frequency: 60,
      });

      await mgr.getRepository(PsAuth).save({
        id,
        auth_type: 'userpass',
        username: id,
        password: dto.secret,
      });

      await mgr.getRepository(PsEndpoint).save({
        id,
        transport: webrtc ? 'transport-wss' : 'transport-udp',
        aors: id,
        auth: id,
        context: 'from-internal',
        callerid: sanitizeText(
          `${dto.displayName ?? id} <${id}>`,
          80,
        ),
        webrtc: webrtc ? 'yes' : 'no',
        use_avpf: webrtc ? 'yes' : 'no',
        media_encryption: webrtc ? 'dtls' : null,
        dtls_auto_generate_cert: webrtc ? 'yes' : null,
        rtcp_mux: webrtc ? 'yes' : null,
        ice_support: webrtc ? 'yes' : 'no',
        rewrite_contact: 'yes',
        rtp_symmetric: 'yes',
        force_rport: 'yes',
        direct_media: 'no',
        call_group: dto.callGroup ?? null,
        pickup_group: dto.pickupGroup ?? null,
        allow: 'ulaw,alaw,opus',
        disallow: '!all,ulaw,alaw,opus',
      });

      const ext = mgr.getRepository(Extension).create({
        extensionNumber: id,
        displayName: dto.displayName ?? null,
        department: dto.department ?? null,
        webrtc,
        recordingEnabled: dto.recordingEnabled ?? false,
        callGroup: dto.callGroup ?? null,
        pickupGroup: dto.pickupGroup ?? null,
        isActive: dto.isActive ?? true,
      });
      const saved = await mgr.getRepository(Extension).save(ext);
      this.logger.log(`Extension ${id} created (webrtc=${webrtc})`);
      return saved;
    });
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<ExtensionWithStatus>> {
    const { page, limit, search } = query;
    const [data, total] = await this.extRepo.findAndCount({
      where: search
        ? [
            { extensionNumber: ILike(`%${search}%`) },
            { displayName: ILike(`%${search}%`) },
          ]
        : {},
      order: { extensionNumber: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const withStatus = await Promise.all(
      data.map((e) => this.attachStatus(e)),
    );
    return paginate(withStatus, total, page, limit);
  }

  async findOne(id: string): Promise<ExtensionWithStatus> {
    const ext = await this.extRepo.findOne({ where: { id } });
    if (!ext) throw new NotFoundException('Extension not found');
    return this.attachStatus(ext);
  }

  private async attachStatus(ext: Extension): Promise<ExtensionWithStatus> {
    let registration: ExtensionWithStatus['registration'] = null;
    try {
      const raw = await this.redis.client.hgetall(
        KEYS.endpointState(ext.extensionNumber),
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
        `Could not read live state for ${ext.extensionNumber}: ${(err as Error).message}`,
      );
    }
    return { ...ext, registration };
  }

  async update(id: string, dto: UpdateExtensionDto): Promise<Extension> {
    const ext = await this.extRepo.findOne({ where: { id } });
    if (!ext) throw new NotFoundException('Extension not found');
    const number = ext.extensionNumber;

    return this.dataSource.transaction(async (mgr) => {
      const webrtc = dto.webrtc ?? ext.webrtc;

      if (dto.secret) {
        await mgr.getRepository(PsAuth).update(number, {
          password: dto.secret,
        });
      }

      await mgr.getRepository(PsEndpoint).update(number, {
        transport: webrtc ? 'transport-wss' : 'transport-udp',
        webrtc: webrtc ? 'yes' : 'no',
        use_avpf: webrtc ? 'yes' : 'no',
        media_encryption: webrtc ? 'dtls' : null,
        dtls_auto_generate_cert: webrtc ? 'yes' : null,
        rtcp_mux: webrtc ? 'yes' : null,
        ice_support: webrtc ? 'yes' : 'no',
        callerid:
          dto.displayName !== undefined
            ? sanitizeText(`${dto.displayName} <${number}>`, 80)
            : ext.displayName
              ? sanitizeText(`${ext.displayName} <${number}>`, 80)
              : undefined,
        call_group: dto.callGroup ?? ext.callGroup,
        pickup_group: dto.pickupGroup ?? ext.pickupGroup,
      });

      await mgr.getRepository(Extension).update(id, {
        displayName: dto.displayName ?? ext.displayName,
        department: dto.department ?? ext.department,
        webrtc,
        recordingEnabled: dto.recordingEnabled ?? ext.recordingEnabled,
        callGroup: dto.callGroup ?? ext.callGroup,
        pickupGroup: dto.pickupGroup ?? ext.pickupGroup,
        isActive: dto.isActive ?? ext.isActive,
      });

      const updated = await mgr
        .getRepository(Extension)
        .findOneByOrFail({ id });
      this.logger.log(`Extension ${number} updated`);
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    const ext = await this.extRepo.findOne({ where: { id } });
    if (!ext) throw new NotFoundException('Extension not found');
    const number = ext.extensionNumber;

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(Extension).delete(id);
      await mgr.getRepository(PsEndpoint).delete(number);
      await mgr.getRepository(PsAuth).delete(number);
      await mgr.getRepository(PsAor).delete(number);
    });
    this.logger.log(`Extension ${number} deleted`);
  }
}
