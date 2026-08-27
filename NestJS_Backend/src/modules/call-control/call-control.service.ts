import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import { TelephonyService } from '../../telephony/telephony.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { assertSafeDialToken, sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  ChannelDto,
  ChannelIdDto,
  OriginateDto,
  ParkDto,
  TransferDto,
} from './dto/call-control.dto';

export interface ParkedCallView {
  slot: string;
  channel: string;
  callerNum: string;
  callerName: string;
  parkerDialString: string;
  parkedAt: string;
}

/**
 * Agent-facing live call controls. Agents may only act on channels that belong
 * to their own extension (verified against the Redis active-call projection);
 * admins bypass the ownership check. This service never touches AMI/ARI
 * directly — it delegates to TelephonyService, the single Asterisk owner.
 */
@Injectable()
export class CallControlService {
  private readonly logger = new Logger(CallControlService.name);

  constructor(
    private readonly telephony: TelephonyService,
    private readonly redis: RedisService,
  ) {}

  // =========================================================================
  //  Ownership / role helpers
  // =========================================================================

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  private requireExtension(user: AuthenticatedUser): string {
    if (!user.extension) {
      throw new ForbiddenException(
        'No extension is associated with this account',
      );
    }
    return user.extension;
  }

  /** Find the active-call hash whose `channel` field matches a channel name. */
  private async findActiveCallByChannel(
    channel: string,
  ): Promise<Record<string, string> | null> {
    const ids = await this.redis.client.smembers(KEYS.activeCallIndex());
    for (const id of ids) {
      const hash = await this.redis.client.hgetall(KEYS.activeCall(id));
      if (hash && hash.channel === channel) return hash;
    }
    return null;
  }

  /** Assert the caller owns the call identified by an ARI channel id/uniqueid. */
  private async assertOwnsChannelId(
    user: AuthenticatedUser,
    channelId: string,
  ): Promise<void> {
    if (this.isAdmin(user)) return;
    const ext = this.requireExtension(user);
    const hash = await this.redis.client.hgetall(KEYS.activeCall(channelId));
    if (!hash || Object.keys(hash).length === 0) {
      throw new ForbiddenException('Channel not found among your active calls');
    }
    if (hash.extension !== ext) {
      throw new ForbiddenException('You may only act on your own active calls');
    }
  }

  /**
   * Assert the caller owns the call identified by an AMI channel name.
   * Returns the matched active-call hash (or null for admins with no match).
   */
  private async assertOwnsChannel(
    user: AuthenticatedUser,
    channel: string,
  ): Promise<Record<string, string> | null> {
    const hash = await this.findActiveCallByChannel(channel);
    if (this.isAdmin(user)) return hash;
    const ext = this.requireExtension(user);
    if (!hash) {
      throw new ForbiddenException('Channel not found among your active calls');
    }
    if (hash.extension !== ext) {
      throw new ForbiddenException('You may only act on your own active calls');
    }
    return hash;
  }

  // =========================================================================
  //  Actions
  // =========================================================================

  async originate(
    user: AuthenticatedUser,
    dto: OriginateDto,
  ): Promise<{ actionId: string; fromExtension: string; to: string }> {
    const to = assertSafeDialToken(dto.to, 'to');

    let fromExtension: string;
    if (this.isAdmin(user) && dto.fromExtension) {
      fromExtension = dto.fromExtension;
    } else {
      if (dto.fromExtension && dto.fromExtension !== user.extension) {
        throw new ForbiddenException(
          'Agents may only originate from their own extension',
        );
      }
      fromExtension = this.requireExtension(user);
    }

    const callerId = dto.callerId ? sanitizeText(dto.callerId, 80) : undefined;
    const res = await this.telephony.originateCall({
      fromExtension,
      to,
      callerId,
    });
    this.logger.log(
      `Originate ${fromExtension} -> ${to} by ${user.username}`,
    );
    return { actionId: res.actionId, fromExtension, to };
  }

  async answer(
    user: AuthenticatedUser,
    dto: ChannelIdDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannelId(user, dto.channelId);
    await this.telephony.answerCall(dto.channelId);
    return { status: 'ok' };
  }

  async hangup(
    user: AuthenticatedUser,
    dto: ChannelDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    await this.telephony.hangupCall(dto.channel);
    this.logger.log(`Hangup ${dto.channel} by ${user.username}`);
    return { status: 'ok' };
  }

  async hold(
    user: AuthenticatedUser,
    dto: ChannelIdDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannelId(user, dto.channelId);
    await this.telephony.holdCall(dto.channelId);
    return { status: 'ok' };
  }

  async unhold(
    user: AuthenticatedUser,
    dto: ChannelIdDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannelId(user, dto.channelId);
    await this.telephony.unholdCall(dto.channelId);
    return { status: 'ok' };
  }

  async transfer(
    user: AuthenticatedUser,
    dto: TransferDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    const to = assertSafeDialToken(dto.to, 'to');
    await this.telephony.transferCall({
      channel: dto.channel,
      to,
      type: dto.type,
    });
    this.logger.log(
      `${dto.type} transfer ${dto.channel} -> ${to} by ${user.username}`,
    );
    return { status: 'ok' };
  }

  async park(
    user: AuthenticatedUser,
    dto: ParkDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    await this.telephony.parkCall(dto.channel, dto.announceChannel);
    this.logger.log(`Park ${dto.channel} by ${user.username}`);
    return { status: 'ok' };
  }

  async startRecording(
    user: AuthenticatedUser,
    dto: ChannelDto,
  ): Promise<{ status: 'ok'; file: string }> {
    const owner = await this.assertOwnsChannel(user, dto.channel);
    const ext = user.extension ?? owner?.extension ?? 'rec';
    const fileBase = `${ext}-${Date.now()}`;
    const file = await this.telephony.startRecording(dto.channel, fileBase);
    this.logger.log(`Recording started on ${dto.channel} -> ${file}`);
    return { status: 'ok', file };
  }

  async stopRecording(
    user: AuthenticatedUser,
    dto: ChannelDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    await this.telephony.stopRecording(dto.channel);
    this.logger.log(`Recording stopped on ${dto.channel}`);
    return { status: 'ok' };
  }

  /** Directed call pickup: answer a call ringing at another extension. */
  async pickup(
    user: AuthenticatedUser,
    targetExtension: string,
  ): Promise<{ status: 'ok'; actionId: string }> {
    const picker = this.requireExtension(user);
    const { actionId } = await this.telephony.pickupCall({
      pickerExtension: picker,
      targetExtension,
    });
    this.logger.log(`${picker} picked up call ringing at ${targetExtension}`);
    return { status: 'ok', actionId };
  }

  /** PCI-DSS: mute recording while sensitive (e.g. card) data is spoken. */
  async pauseRecording(
    user: AuthenticatedUser,
    dto: ChannelDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    await this.telephony.pauseRecording(dto.channel);
    this.logger.log(`Recording paused on ${dto.channel}`);
    return { status: 'ok' };
  }

  async resumeRecording(
    user: AuthenticatedUser,
    dto: ChannelDto,
  ): Promise<{ status: 'ok' }> {
    await this.assertOwnsChannel(user, dto.channel);
    await this.telephony.resumeRecording(dto.channel);
    this.logger.log(`Recording resumed on ${dto.channel}`);
    return { status: 'ok' };
  }

  /** Live parked-call list from Redis (shared parking lot, visible to all). */
  async listParked(): Promise<ParkedCallView[]> {
    const slots = await this.redis.client.smembers(KEYS.parkIndex());
    const results: ParkedCallView[] = [];
    for (const slot of slots) {
      const hash = await this.redis.client.hgetall(KEYS.parkedCall(slot));
      if (!hash || Object.keys(hash).length === 0) continue;
      results.push({
        slot: hash.slot ?? slot,
        channel: hash.channel ?? '',
        callerNum: hash.callerNum ?? '',
        callerName: hash.callerName ?? '',
        parkerDialString: hash.parkerDialString ?? '',
        parkedAt: hash.parkedAt ?? '',
      });
    }
    return results.sort((a, b) => a.slot.localeCompare(b.slot));
  }
}
