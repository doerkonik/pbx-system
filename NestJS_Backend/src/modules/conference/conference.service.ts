import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Conference } from '../../database/entities';
import {
  CreateConferenceDto,
  UpdateConferenceDto,
} from './dto/conference.dto';
import { TelephonyService } from '../../telephony/telephony.service';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import { assertSafeAsteriskId } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

export interface ConferenceParticipant {
  /** ARI channel id (== the AMI channel to hang up). */
  channelId: string;
  /** Extension that was originated into the room. */
  extension: string;
}

/**
 * Owns ConfBridge room config (`conferences` table). Live participants are
 * tracked by the telephony module in Redis (KEYS.conference(room)); adding /
 * removing members goes through TelephonyService, the only path to Asterisk.
 */
@Injectable()
export class ConferenceService {
  private readonly logger = new Logger(ConferenceService.name);

  constructor(
    @InjectRepository(Conference)
    private readonly confRepo: Repository<Conference>,
    private readonly telephony: TelephonyService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateConferenceDto): Promise<Conference> {
    const roomNumber = assertSafeAsteriskId(dto.roomNumber, 'roomNumber');

    const existing = await this.confRepo.findOne({ where: { roomNumber } });
    if (existing) {
      throw new ConflictException(`Conference room ${roomNumber} already exists`);
    }

    const entity = this.confRepo.create({
      roomNumber,
      name: dto.name,
      pin: dto.pin ?? null,
      adminPin: dto.adminPin ?? null,
      recordingEnabled: dto.recordingEnabled ?? true,
      mohClass: dto.mohClass ?? 'default',
      isActive: dto.isActive ?? true,
    });
    const saved = await this.confRepo.save(entity);
    this.logger.log(`Conference room ${roomNumber} created`);
    // Never leak the select:false PIN columns back to the caller.
    return this.findOne(saved.id);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<Conference>> {
    const { page, limit, search } = query;
    const [data, total] = await this.confRepo.findAndCount({
      where: search
        ? [
            { roomNumber: ILike(`%${search}%`) },
            { name: ILike(`%${search}%`) },
          ]
        : {},
      order: { roomNumber: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Conference> {
    // pin/adminPin are select:false, so they are excluded here by default.
    const conf = await this.confRepo.findOne({ where: { id } });
    if (!conf) throw new NotFoundException('Conference not found');
    return conf;
  }

  async update(id: string, dto: UpdateConferenceDto): Promise<Conference> {
    const conf = await this.confRepo.findOne({ where: { id } });
    if (!conf) throw new NotFoundException('Conference not found');

    if (dto.roomNumber !== undefined) {
      const roomNumber = assertSafeAsteriskId(dto.roomNumber, 'roomNumber');
      if (roomNumber !== conf.roomNumber) {
        const clash = await this.confRepo.findOne({ where: { roomNumber } });
        if (clash) {
          throw new ConflictException(
            `Conference room ${roomNumber} already exists`,
          );
        }
      }
      conf.roomNumber = roomNumber;
    }
    if (dto.name !== undefined) conf.name = dto.name;
    if (dto.pin !== undefined) conf.pin = dto.pin;
    if (dto.adminPin !== undefined) conf.adminPin = dto.adminPin;
    if (dto.recordingEnabled !== undefined) {
      conf.recordingEnabled = dto.recordingEnabled;
    }
    if (dto.mohClass !== undefined) conf.mohClass = dto.mohClass;
    if (dto.isActive !== undefined) conf.isActive = dto.isActive;

    await this.confRepo.save(conf);
    this.logger.log(`Conference room ${conf.roomNumber} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const conf = await this.confRepo.findOne({ where: { id } });
    if (!conf) throw new NotFoundException('Conference not found');
    await this.confRepo.delete(id);
    this.logger.log(`Conference room ${conf.roomNumber} deleted`);
  }

  /** Brings an extension into the room via ConfBridge (delegates to Asterisk). */
  async addParticipant(id: string, extension: string): Promise<{ status: string }> {
    const conf = await this.findOne(id);
    const ext = assertSafeAsteriskId(extension, 'extension');
    await this.telephony.addToConference(conf.roomNumber, ext);
    this.logger.log(`Added ${ext} to conference room ${conf.roomNumber}`);
    return { status: 'invited' };
  }

  /** Reads the live participant hash the telephony module maintains in Redis. */
  async listParticipants(id: string): Promise<ConferenceParticipant[]> {
    const conf = await this.findOne(id);
    let raw: Record<string, string> = {};
    try {
      raw = await this.redis.client.hgetall(KEYS.conference(conf.roomNumber));
    } catch (err) {
      this.logger.warn(
        `Could not read participants for room ${conf.roomNumber}: ${(err as Error).message}`,
      );
      return [];
    }
    return Object.entries(raw ?? {}).map(([channelId, extension]) => ({
      channelId,
      extension,
    }));
  }

  /** Hangs up a single participant channel (the AMI channel id) and clears state. */
  async removeParticipant(id: string, channelId: string): Promise<void> {
    const conf = await this.findOne(id);
    const key = KEYS.conference(conf.roomNumber);

    const member = await this.redis.client.hget(key, channelId);
    if (member === null) {
      throw new NotFoundException('Participant not found in this conference');
    }

    await this.telephony.hangupCall(channelId);
    await this.redis.client.hdel(key, channelId).catch(() => undefined);
    this.logger.log(
      `Removed participant ${channelId} from conference room ${conf.roomNumber}`,
    );
  }

  /** Mute or unmute a single participant (moderation). */
  async muteParticipant(
    id: string,
    channelId: string,
    mute: boolean,
  ): Promise<{ status: 'ok' }> {
    const conf = await this.findOne(id);
    const member = await this.redis.client.hget(
      KEYS.conference(conf.roomNumber),
      channelId,
    );
    if (member === null) {
      throw new NotFoundException('Participant not found in this conference');
    }
    await this.telephony.setChannelMute(channelId, mute);
    this.logger.log(
      `${mute ? 'Muted' : 'Unmuted'} ${channelId} in room ${conf.roomNumber}`,
    );
    return { status: 'ok' };
  }

  /**
   * Lock/unlock a room against new joins. The flag is stored in Redis; the
   * Stasis join handler honours it (enforcement wiring is a telephony follow-up).
   */
  async setLock(id: string, locked: boolean): Promise<{ locked: boolean }> {
    const conf = await this.findOne(id);
    const key = `conf:${conf.roomNumber}:locked`;
    if (locked) await this.redis.client.set(key, '1');
    else await this.redis.client.del(key);
    this.logger.log(`Conference ${conf.roomNumber} ${locked ? 'locked' : 'unlocked'}`);
    return { locked };
  }
}
