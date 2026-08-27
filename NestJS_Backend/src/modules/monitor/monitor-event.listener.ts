import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { CHANNELS } from '../../redis/redis.constants';
import { EventsGateway } from '../../realtime/events.gateway';
import { NormalizedTelephonyEvent } from '../../telephony/interfaces/telephony-event.interface';
import { ChannelStateService } from './channel-state.service';

/**
 * Subscribes to the shared normalized telephony event bus (Redis pub/sub) and
 * folds each event into the ChannelStateService, producing live diffs.
 *
 * Because it reads from Redis pub/sub, every NestJS instance runs its own copy
 * and stays consistent — multi-instance-ready with no shared write-state. In
 * Step 1 the diffs are console-logged for verification; Step 2 fans them out to
 * supervisor WebSocket clients.
 */
@Injectable()
export class MonitorEventListener implements OnModuleInit {
  private readonly logger = new Logger(MonitorEventListener.name);

  constructor(
    private readonly redis: RedisService,
    private readonly channelState: ChannelStateService,
    private readonly gateway: EventsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const sub = this.redis.subscriber;
    try {
      // Idempotent — RedisSubscriberService may already subscribe this channel.
      await sub.subscribe(CHANNELS.TELEPHONY_EVENTS);
    } catch (err) {
      this.logger.error(`Monitor subscribe failed: ${(err as Error).message}`);
    }

    sub.on('message', (channel, message) => {
      if (channel !== CHANNELS.TELEPHONY_EVENTS) return;
      try {
        const ev = JSON.parse(message) as NormalizedTelephonyEvent;
        this.ingest(ev);
      } catch (err) {
        this.logger.error(`Bad monitor event: ${(err as Error).message}`);
      }
    });

    this.logger.log('Monitor event listener active (broadcasting to supervisors)');
  }

  private ingest(ev: NormalizedTelephonyEvent): void {
    const diffs = this.channelState.apply(ev);
    for (const d of diffs) {
      // Named diffs → the staff room (admins + supervisors both live here).
      // Emitting per-instance avoids the cross-instance re-publish duplication
      // that a shared Redis broadcast channel would cause.
      this.gateway.emitToAdmins(d.event, d);
      this.logger.debug(`[${d.event}] ${d.channelId ?? ''}`);
    }
  }
}
