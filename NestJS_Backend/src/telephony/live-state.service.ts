import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { KEYS, TTL } from '../redis/redis.constants';
import { TelephonyEvent } from '../common/enums';
import { NormalizedTelephonyEvent } from './interfaces/telephony-event.interface';

/**
 * Projects normalized telephony events into Redis live-state keys so the REST
 * layer and reconnecting dashboards can read a current snapshot without
 * replaying the event stream. Every write is best-effort and logged on failure.
 */
@Injectable()
export class LiveStateService {
  private readonly logger = new Logger(LiveStateService.name);

  constructor(private readonly redis: RedisService) {}

  async apply(ev: NormalizedTelephonyEvent): Promise<void> {
    try {
      await this.project(ev);
    } catch (err) {
      this.logger.error(
        `Live-state update failed for ${ev.event}: ${(err as Error).message}`,
      );
    }
  }

  private async project(ev: NormalizedTelephonyEvent): Promise<void> {
    const r = this.redis.client;

    // --- Endpoint / agent presence -----------------------------------------
    if (ev.extension && ev.presence) {
      const key = KEYS.endpointState(ev.extension);
      await r.hset(key, {
        extension: ev.extension,
        presence: ev.presence,
        reason: ev.reason ?? '',
        channel: ev.channel ?? '',
        updatedAt: ev.timestamp,
      });
      await r.expire(key, TTL.ENDPOINT_STATE);
      await r.sadd(KEYS.agentIndex(), ev.extension);
    }

    // --- Active calls -------------------------------------------------------
    switch (ev.event) {
      case TelephonyEvent.CALL_START:
      case TelephonyEvent.CALL_RINGING:
      case TelephonyEvent.CALL_ANSWERED:
      case TelephonyEvent.CALL_HOLD:
      case TelephonyEvent.CALL_UNHOLD:
        if (ev.uniqueid) {
          const key = KEYS.activeCall(ev.uniqueid);
          await r.hset(key, {
            uniqueid: ev.uniqueid,
            linkedid: ev.linkedid ?? '',
            channel: ev.channel ?? '',
            extension: ev.extension ?? '',
            state: ev.event,
            callerNum: ev.callerId?.num ?? '',
            callerName: ev.callerId?.name ?? '',
            connectedNum: ev.connectedLine?.num ?? '',
            updatedAt: ev.timestamp,
          });
          await r.expire(key, TTL.ACTIVE_CALL);
          await r.sadd(KEYS.activeCallIndex(), ev.uniqueid);
        }
        break;

      case TelephonyEvent.CALL_HANGUP:
        if (ev.uniqueid) {
          await r.del(KEYS.activeCall(ev.uniqueid));
          await r.srem(KEYS.activeCallIndex(), ev.uniqueid);
        }
        break;

      // --- Parking ---------------------------------------------------------
      case TelephonyEvent.PARK_ADD:
        if (ev.parkingSlot) {
          const key = KEYS.parkedCall(ev.parkingSlot);
          await r.hset(key, {
            slot: ev.parkingSlot,
            channel: ev.channel ?? '',
            callerNum: ev.callerId?.num ?? '',
            callerName: ev.callerId?.name ?? '',
            parkerDialString: ev.parkerDialString ?? '',
            parkedAt: ev.timestamp,
          });
          await r.expire(key, TTL.PARKED_CALL);
          await r.sadd(KEYS.parkIndex(), ev.parkingSlot);
        }
        break;

      case TelephonyEvent.PARK_REMOVE:
        if (ev.parkingSlot) {
          await r.del(KEYS.parkedCall(ev.parkingSlot));
          await r.srem(KEYS.parkIndex(), ev.parkingSlot);
        }
        break;

      // --- Queue membership pause -----------------------------------------
      case TelephonyEvent.AGENT_PAUSE:
      case TelephonyEvent.AGENT_UNPAUSE:
        if (ev.extension) {
          const key = KEYS.agentState(ev.extension);
          await r.hset(key, {
            extension: ev.extension,
            presence: ev.presence ?? '',
            reason: ev.reason ?? '',
            queue: ev.queue ?? '',
            updatedAt: ev.timestamp,
          });
          await r.expire(key, TTL.AGENT_STATE);
        }
        break;
      default:
        break;
    }
  }

  /** Replace the cached snapshot for a queue (written by QueueSnapshotService). */
  async setQueueSnapshot(name: string, snapshot: Record<string, any>): Promise<void> {
    try {
      const key = KEYS.queueSnapshot(name);
      await this.redis.client.hset(key, snapshot as any);
      await this.redis.client.expire(key, TTL.QUEUE_SNAPSHOT);
      await this.redis.client.sadd(KEYS.queueIndex(), name);
    } catch (err) {
      this.logger.error(`Queue snapshot write failed: ${(err as Error).message}`);
    }
  }
}
