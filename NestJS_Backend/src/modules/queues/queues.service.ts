import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import {
  AstQueue,
  AstQueueMember,
  QueueConfig,
} from '../../database/entities';
import {
  AddQueueMemberDto,
  CreateQueueDto,
  UpdateQueueDto,
} from './dto/queue.dto';
import { RedisService } from '../../redis/redis.service';
import { TelephonyService } from '../../telephony/telephony.service';
import { KEYS } from '../../redis/redis.constants';
import { QueueStrategy } from '../../common/enums';
import {
  assertSafeAsteriskId,
  sanitizeText,
} from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

export interface QueueWithSnapshot extends QueueConfig {
  live: Record<string, string> | null;
}

/**
 * Owns queue lifecycle. Writes the realtime `queues` row Asterisk reads live
 * AND the app-level `queue_config` metadata row inside one transaction, so
 * admin-created queues go live without an Asterisk reload. Member changes are
 * dual-written: a `queue_members` row for persistence plus an AMI QueueAdd/
 * QueueRemove via TelephonyService so the change takes effect immediately.
 */
@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @InjectRepository(QueueConfig)
    private readonly configRepo: Repository<QueueConfig>,
    @InjectRepository(AstQueueMember)
    private readonly memberRepo: Repository<AstQueueMember>,
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly telephony: TelephonyService,
  ) {}

  async create(dto: CreateQueueDto): Promise<QueueConfig> {
    const name = assertSafeAsteriskId(dto.name, 'name');

    const existing = await this.configRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException(`Queue ${name} already exists`);
    }

    const strategy = dto.strategy ?? QueueStrategy.RRMEMORY;
    const mohClass = dto.mohClass ?? 'default';
    const timeout = dto.timeout ?? 15;
    const wrapupTime = dto.wrapupTime ?? 0;
    const ringinuse = dto.ringinuse ?? true;

    const saved = await this.dataSource.transaction(async (mgr) => {
      // Realtime row — the Asterisk contract.
      await mgr.getRepository(AstQueue).save({
        name,
        strategy,
        timeout,
        wrapuptime: wrapupTime,
        musiconhold: mohClass,
        maxlen: dto.maxlen ?? 0,
        ringinuse: ringinuse ? 'yes' : 'no',
      });

      // App-level metadata row.
      const config = mgr.getRepository(QueueConfig).create({
        name,
        displayName: dto.displayName ? sanitizeText(dto.displayName, 120) : null,
        strategy,
        mohClass,
        timeout,
        wrapupTime,
        maxWait: dto.maxWait ?? null,
        overflowDestType: dto.overflowDestType ?? null,
        overflowDestValue: dto.overflowDestValue ?? null,
        recordingEnabled: dto.recordingEnabled ?? false,
        isActive: true,
      });
      return mgr.getRepository(QueueConfig).save(config);
    });

    // Register the queue so the dashboard can enumerate it before any snapshot.
    try {
      await this.redis.client.sadd(KEYS.queueIndex(), name);
    } catch (err) {
      this.logger.warn(
        `Could not index queue ${name}: ${(err as Error).message}`,
      );
    }

    this.logger.log(`Queue ${name} created (strategy=${strategy})`);
    return saved;
  }

  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<QueueConfig>> {
    const { page, limit, search } = query;
    const [data, total] = await this.configRepo.findAndCount({
      where: search
        ? [
            { name: ILike(`%${search}%`) },
            { displayName: ILike(`%${search}%`) },
          ]
        : {},
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(name: string): Promise<QueueWithSnapshot> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');
    const live = await this.readSnapshot(id);
    return { ...config, live };
  }

  /** Live snapshot hash written by the telephony QueueSnapshotService. */
  async getLive(name: string): Promise<Record<string, string>> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');
    return (await this.readSnapshot(id)) ?? {};
  }

  private async readSnapshot(
    name: string,
  ): Promise<Record<string, string> | null> {
    try {
      const raw = await this.redis.client.hgetall(KEYS.queueSnapshot(name));
      return raw && Object.keys(raw).length > 0 ? raw : null;
    } catch (err) {
      this.logger.warn(
        `Could not read live snapshot for ${name}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async update(name: string, dto: UpdateQueueDto): Promise<QueueConfig> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');

    const strategy = dto.strategy ?? config.strategy;
    const mohClass = dto.mohClass ?? config.mohClass;
    const timeout = dto.timeout ?? config.timeout;
    const wrapupTime = dto.wrapupTime ?? config.wrapupTime;

    return this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(AstQueue).update(id, {
        strategy,
        timeout,
        wrapuptime: wrapupTime,
        musiconhold: mohClass,
        ...(dto.maxlen !== undefined ? { maxlen: dto.maxlen } : {}),
        ...(dto.ringinuse !== undefined
          ? { ringinuse: dto.ringinuse ? 'yes' : 'no' }
          : {}),
      });

      await mgr.getRepository(QueueConfig).update(
        { name: id },
        {
          displayName:
            dto.displayName !== undefined
              ? sanitizeText(dto.displayName, 120)
              : config.displayName,
          strategy,
          mohClass,
          timeout,
          wrapupTime,
          maxWait: dto.maxWait ?? config.maxWait,
          overflowDestType: dto.overflowDestType ?? config.overflowDestType,
          overflowDestValue: dto.overflowDestValue ?? config.overflowDestValue,
          recordingEnabled: dto.recordingEnabled ?? config.recordingEnabled,
          isActive: dto.isActive ?? config.isActive,
        },
      );

      const updated = await mgr
        .getRepository(QueueConfig)
        .findOneByOrFail({ name: id });
      this.logger.log(`Queue ${id} updated`);
      return updated;
    });
  }

  async remove(name: string): Promise<void> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(AstQueueMember).delete({ queue_name: id });
      await mgr.getRepository(AstQueue).delete(id);
      await mgr.getRepository(QueueConfig).delete({ name: id });
    });

    try {
      await this.redis.client.srem(KEYS.queueIndex(), id);
    } catch (err) {
      this.logger.warn(
        `Could not de-index queue ${id}: ${(err as Error).message}`,
      );
    }
    this.logger.log(`Queue ${id} deleted`);
  }

  // =========================================================================
  //  Member management
  // =========================================================================

  async listMembers(name: string): Promise<AstQueueMember[]> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');
    return this.memberRepo.find({
      where: { queue_name: id },
      order: { penalty: 'ASC', uniqueid: 'ASC' },
    });
  }

  async addMember(
    name: string,
    dto: AddQueueMemberDto,
  ): Promise<AstQueueMember> {
    const id = assertSafeAsteriskId(name, 'name');
    const extension = assertSafeAsteriskId(dto.extension, 'extension');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');

    const interfaceName = `PJSIP/${extension}`;
    const existing = await this.memberRepo.findOne({
      where: { queue_name: id, interface: interfaceName },
    });
    if (existing) {
      throw new ConflictException(
        `Extension ${extension} is already a member of queue ${id}`,
      );
    }

    const memberName = dto.memberName
      ? sanitizeText(dto.memberName, 128)
      : extension;
    const penalty = dto.penalty ?? 0;
    const paused = dto.paused ?? false;

    // Persist the realtime membership row.
    const member = await this.memberRepo.save(
      this.memberRepo.create({
        queue_name: id,
        interface: interfaceName,
        membername: memberName,
        state_interface: interfaceName,
        penalty,
        paused: paused ? 1 : 0,
      }),
    );

    // Push it live so it takes effect without a reload.
    await this.telephony.addQueueMember({
      queue: id,
      interfaceName,
      memberName,
      penalty,
      paused,
    });

    this.logger.log(`Added ${interfaceName} to queue ${id}`);
    return member;
  }

  /**
   * Reconcile a queue's membership to a skill-based routing plan. Adds qualified
   * agents who aren't members and re-penalises existing members whose penalty
   * changed. Non-listed members are left untouched (so manual members survive).
   */
  async applySkillMembership(
    name: string,
    desired: { extension: string; penalty: number }[],
  ): Promise<{ added: number; updated: number }> {
    const id = assertSafeAsteriskId(name, 'name');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');

    const current = await this.memberRepo.find({ where: { queue_name: id } });
    const byIface = new Map(current.map((m) => [m.interface, m]));
    let added = 0;
    let updated = 0;

    for (const d of desired) {
      const ext = assertSafeAsteriskId(d.extension, 'extension');
      const interfaceName = `PJSIP/${ext}`;
      const existing = byIface.get(interfaceName);
      if (!existing) {
        await this.memberRepo.save(
          this.memberRepo.create({
            queue_name: id,
            interface: interfaceName,
            membername: ext,
            state_interface: interfaceName,
            penalty: d.penalty,
            paused: 0,
          }),
        );
        await this.telephony.addQueueMember({
          queue: id,
          interfaceName,
          memberName: ext,
          penalty: d.penalty,
        });
        added += 1;
      } else if (existing.penalty !== d.penalty) {
        await this.memberRepo.update(
          { uniqueid: existing.uniqueid },
          { penalty: d.penalty },
        );
        await this.telephony.setQueuePenalty(id, interfaceName, d.penalty);
        updated += 1;
      }
    }
    this.logger.log(
      `Applied skill membership to ${id}: +${added} added, ${updated} re-penalised`,
    );
    return { added, updated };
  }

  async removeMember(name: string, extension: string): Promise<void> {
    const id = assertSafeAsteriskId(name, 'name');
    const ext = assertSafeAsteriskId(extension, 'extension');
    const config = await this.configRepo.findOne({ where: { name: id } });
    if (!config) throw new NotFoundException('Queue not found');

    const interfaceName = `PJSIP/${ext}`;
    const member = await this.memberRepo.findOne({
      where: { queue_name: id, interface: interfaceName },
    });
    if (!member) {
      throw new NotFoundException(
        `Extension ${ext} is not a member of queue ${id}`,
      );
    }

    await this.memberRepo.delete({ uniqueid: member.uniqueid });
    await this.telephony.removeQueueMember(id, interfaceName);
    this.logger.log(`Removed ${interfaceName} from queue ${id}`);
  }
}
