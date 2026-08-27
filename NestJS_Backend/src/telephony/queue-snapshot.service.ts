import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AmiService } from './ami.service';
import { LiveStateService } from './live-state.service';
import { RedisService } from '../redis/redis.service';
import { CHANNELS } from '../redis/redis.constants';
import { TelephonyEvent } from '../common/enums';

/**
 * Periodically polls AMI QueueStatus and projects a compact snapshot per queue
 * (waiting callers, longest wait, logged-in / available members) into Redis so
 * the dashboard can render live queue tiles. Publishes a QUEUE_SNAPSHOT event
 * on each refresh for push updates.
 */
@Injectable()
export class QueueSnapshotService implements OnModuleInit {
  private readonly logger = new Logger(QueueSnapshotService.name);
  private timer?: NodeJS.Timeout;
  private readonly intervalMs = 5000;

  constructor(
    private readonly ami: AmiService,
    private readonly liveState: LiveStateService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.refresh(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  private async refresh(): Promise<void> {
    if (!this.ami.isConnected()) return;
    try {
      const events = await this.collectQueueStatus();
      const queues = this.aggregate(events);
      for (const [name, snap] of Object.entries(queues)) {
        await this.liveState.setQueueSnapshot(name, snap);
        await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, {
          event: TelephonyEvent.QUEUE_SNAPSHOT,
          timestamp: new Date().toISOString(),
          source: 'ami',
          queue: name,
          raw: snap,
        });
      }
    } catch (err) {
      this.logger.debug(`Queue snapshot refresh skipped: ${(err as Error).message}`);
    }
  }

  /**
   * QueueStatus is a multi-event AMI action: it streams QueueParams / QueueMember
   * / QueueEntry events terminated by QueueStatusComplete. We collect the burst
   * for a short window keyed by our ActionID.
   */
  private collectQueueStatus(): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const collected: Record<string, any>[] = [];
      const actionId = `qs-${Date.now()}`;
      const timer = setTimeout(() => {
        this.ami.removeListener('event', onEvent);
        resolve(collected);
      }, 1500);

      const onEvent = (ev: Record<string, any>) => {
        if (ev.ActionID && ev.ActionID !== actionId) return;
        collected.push(ev);
        if (ev.Event === 'QueueStatusComplete') {
          clearTimeout(timer);
          this.ami.removeListener('event', onEvent);
          resolve(collected);
        }
      };

      this.ami.on('event', onEvent);
      this.ami
        .action({ Action: 'QueueStatus', ActionID: actionId })
        .catch((err) => {
          clearTimeout(timer);
          this.ami.removeListener('event', onEvent);
          reject(err);
        });
    });
  }

  private aggregate(events: Record<string, any>[]): Record<string, any> {
    const queues: Record<string, any> = {};
    for (const ev of events) {
      if (ev.Event === 'QueueParams') {
        queues[ev.Queue] = {
          queue: ev.Queue,
          calls: Number(ev.Calls ?? 0),
          holdtime: Number(ev.Holdtime ?? 0),
          talktime: Number(ev.TalkTime ?? 0),
          completed: Number(ev.Completed ?? 0),
          abandoned: Number(ev.Abandoned ?? 0),
          longestWait: 0,
          membersTotal: 0,
          membersAvailable: 0,
          updatedAt: new Date().toISOString(),
        };
      } else if (ev.Event === 'QueueMember') {
        const q = queues[ev.Queue];
        if (q) {
          q.membersTotal += 1;
          // Status 1 = not in use (available), Paused 0
          if (ev.Status === '1' && ev.Paused === '0') q.membersAvailable += 1;
        }
      } else if (ev.Event === 'QueueEntry') {
        const q = queues[ev.Queue];
        if (q) q.longestWait = Math.max(q.longestWait, Number(ev.Wait ?? 0));
      }
    }
    return queues;
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
