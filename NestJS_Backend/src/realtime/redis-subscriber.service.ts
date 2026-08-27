import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { CHANNELS } from '../redis/redis.constants';
import { EventsGateway } from './events.gateway';
import { NormalizedTelephonyEvent } from '../telephony/interfaces/telephony-event.interface';

/**
 * Bridges Redis pub/sub -> WebSocket rooms. Subscribes to the telephony
 * channels the telephony module publishes on, then routes each normalized event
 * to admins (always) and to the specific agent room when the event names an
 * extension. This is the ONLY place that decides admin-vs-agent visibility for
 * live events, keeping scoping in one auditable spot.
 */
@Injectable()
export class RedisSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(RedisSubscriberService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly gateway: EventsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    const sub = this.redis.subscriber;
    try {
      await sub.subscribe(
        CHANNELS.TELEPHONY_EVENTS,
        CHANNELS.TELEPHONY_CONNECTION,
        CHANNELS.MONITORING_EVENTS,
        CHANNELS.NOTIFICATION_EVENTS,
      );
    } catch (err) {
      this.logger.error(`Redis subscribe failed: ${(err as Error).message}`);
    }

    sub.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        this.dispatch(channel, payload);
      } catch (err) {
        this.logger.error(
          `Bad pub/sub message on ${channel}: ${(err as Error).message}`,
        );
      }
    });

    this.logger.log('Subscribed to telephony Redis channels');
  }

  private dispatch(channel: string, payload: any): void {
    if (channel === CHANNELS.TELEPHONY_CONNECTION) {
      // Connection banner is admin-only.
      this.gateway.emitToAdmins('telephony.connection', payload);
      return;
    }

    if (channel === CHANNELS.MONITORING_EVENTS) {
      // Supervisor monitoring pushes (SLA alerts, spy notices) — staff room
      // (admins + supervisors both live in ROOM_ADMIN).
      this.gateway.emitToAdmins('monitoring.event', payload);
      return;
    }

    if (channel === CHANNELS.NOTIFICATION_EVENTS) {
      // { event, userId?, data }. userId => that user's room; else broadcast.
      const { event, userId, data } = payload as {
        event: string;
        userId?: string;
        data: unknown;
      };
      if (userId) this.gateway.emitToUser(userId, event, data);
      else this.gateway.emitToAll(event, data);
      return;
    }

    const ev = payload as NormalizedTelephonyEvent;
    // Admins see everything.
    this.gateway.emitToAdmins('telephony.event', ev);
    // Scope to the owning agent when the event concerns a specific extension.
    if (ev.extension) {
      this.gateway.emitToAgent(ev.extension, 'telephony.event', ev);
    }
    // Connected-line extension (the other leg) may also be an agent.
    const other = ev.connectedLine?.num;
    if (other && other !== ev.extension) {
      this.gateway.emitToAgent(other, 'telephony.event', ev);
    }
  }
}
