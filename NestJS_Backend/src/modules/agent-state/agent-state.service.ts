import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentPreference } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { CHANNELS } from '../../redis/redis.constants';
import { LiveStateService } from '../../telephony/live-state.service';
import { AgentPresence, TelephonyEvent } from '../../common/enums';
import { NormalizedTelephonyEvent } from '../../telephony/interfaces/telephony-event.interface';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SetAcwDto, SetDndDto } from './dto/agent-state.dto';

export interface AgentStateView {
  extension: string;
  dnd: boolean;
  acw: boolean;
}

/**
 * Agent self-service presence: DND (persisted) and ACW / after-call-work (a
 * transient hint). Both emit a normalized `agent.presence` event so the
 * supervisor dashboard updates live via the existing Redis→WS pipeline.
 *
 * DND here is a presence/notification flag (persisted per agent) that routing
 * can honour; it deliberately does NOT drive Asterisk QueuePause so it can't
 * collide with the breaks module's pause state.
 */
@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);

  constructor(
    @InjectRepository(AgentPreference)
    private readonly prefs: Repository<AgentPreference>,
    private readonly redis: RedisService,
    private readonly liveState: LiveStateService,
  ) {}

  private requireExtension(user: AuthenticatedUser): string {
    if (!user.extension) {
      throw new ForbiddenException(
        'No extension is associated with this account',
      );
    }
    return user.extension;
  }

  async getState(user: AuthenticatedUser): Promise<AgentStateView> {
    const ext = this.requireExtension(user);
    const pref = await this.prefs.findOne({ where: { agentId: user.sub } });
    const presence = await this.redis.client.hget(
      `endpoint:state:${ext}`,
      'presence',
    );
    return {
      extension: ext,
      dnd: pref?.dnd ?? false,
      acw: presence === AgentPresence.ACW,
    };
  }

  async setDnd(user: AuthenticatedUser, dto: SetDndDto): Promise<AgentStateView> {
    const ext = this.requireExtension(user);
    await this.prefs.save({ agentId: user.sub, dnd: dto.on });
    await this.emitPresence(ext, dto.on ? AgentPresence.DND : AgentPresence.IDLE);
    this.logger.log(`Agent ${ext} DND ${dto.on ? 'on' : 'off'}`);
    return this.getState(user);
  }

  async setAcw(user: AuthenticatedUser, dto: SetAcwDto): Promise<AgentStateView> {
    const ext = this.requireExtension(user);
    await this.emitPresence(
      ext,
      dto.on ? AgentPresence.ACW : AgentPresence.IDLE,
      dto.on && dto.seconds ? `acw:${dto.seconds}` : undefined,
    );
    this.logger.log(`Agent ${ext} ACW ${dto.on ? 'started' : 'completed'}`);
    return this.getState(user);
  }

  /** Project + broadcast an agent presence change through the live pipeline. */
  private async emitPresence(
    extension: string,
    presence: AgentPresence,
    reason?: string,
  ): Promise<void> {
    const ev: NormalizedTelephonyEvent = {
      event: TelephonyEvent.AGENT_PRESENCE,
      timestamp: new Date().toISOString(),
      source: 'ami',
      extension,
      presence,
      reason,
    };
    await this.liveState.apply(ev);
    await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, ev);
  }
}
