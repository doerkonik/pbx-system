import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { MonitoringAlert, SlaThreshold } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { CHANNELS, KEYS } from '../../redis/redis.constants';
import { TelephonyService } from '../../telephony/telephony.service';
import { AgentPresence } from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  CreateSlaThresholdDto,
  SpyDto,
  UpdateSlaThresholdDto,
} from './dto/monitoring.dto';

interface QueueLive {
  queue: string;
  calls: number;
  longestWait: number;
  membersAvailable: number;
  membersTotal: number;
  abandoned: number;
  completed: number;
}

interface Breach {
  type: 'wait_exceeded' | 'backlog' | 'no_agents';
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Supervisor monitoring: ChanSpy (listen/whisper/barge), a live wallboard
 * aggregated from Redis, per-queue SLA thresholds, and a periodic evaluator
 * that opens/closes alerts and pushes them to staff over the monitoring channel.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    @InjectRepository(SlaThreshold)
    private readonly thresholds: Repository<SlaThreshold>,
    @InjectRepository(MonitoringAlert)
    private readonly alerts: Repository<MonitoringAlert>,
    private readonly redis: RedisService,
    private readonly telephony: TelephonyService,
  ) {}

  private toNum(v: string | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /* ------------------------ Listen / Whisper / Barge ------------------- */

  async spy(
    user: AuthenticatedUser,
    dto: SpyDto,
  ): Promise<{ actionId: string }> {
    if (!user.extension) {
      throw new ForbiddenException(
        'A supervisor extension is required to monitor calls',
      );
    }
    if (user.extension === dto.targetExtension) {
      throw new ForbiddenException('Cannot monitor your own extension');
    }
    const res = await this.telephony.startChanSpy({
      supervisorExtension: user.extension,
      targetExtension: dto.targetExtension,
      mode: dto.mode,
    });
    await this.publish({
      kind: 'spy',
      event: 'started',
      supervisor: user.extension,
      target: dto.targetExtension,
      mode: dto.mode,
      at: new Date().toISOString(),
    });
    return res;
  }

  /* ------------------------------ Wallboard ---------------------------- */

  async wallboard(): Promise<Record<string, unknown>> {
    const queuesLive = await this.readQueues();
    const thresholds = await this.thresholds.find({ where: { isActive: true } });
    const byQueue = new Map(thresholds.map((t) => [t.queueName, t]));

    const queues = queuesLive.map((q) => {
      const t = byQueue.get(q.queue);
      const breaches = t ? this.evaluate(q, t) : [];
      return { ...q, breaches: breaches.map((b) => b.type), atRisk: breaches.length > 0 };
    });

    const agents = await this.readAgents();
    const activeCalls = await this.redis.client.scard(KEYS.activeCallIndex());
    const openAlerts = await this.alerts.count({ where: { resolvedAt: IsNull() } });

    return {
      generatedAt: new Date().toISOString(),
      kpis: {
        activeCalls,
        agentsOnline: agents.filter((a) => a.presence !== AgentPresence.OFFLINE)
          .length,
        callsWaiting: queues.reduce((s, q) => s + q.calls, 0),
        longestWait: queues.reduce((m, q) => Math.max(m, q.longestWait), 0),
        openAlerts,
      },
      queues,
      agents,
    };
  }

  /* --------------------------- SLA thresholds -------------------------- */

  async createThreshold(dto: CreateSlaThresholdDto): Promise<SlaThreshold> {
    if (await this.thresholds.findOne({ where: { queueName: dto.queueName } })) {
      throw new ConflictException(
        `An SLA threshold for queue "${dto.queueName}" already exists`,
      );
    }
    const entity = this.thresholds.create({ ...dto });
    return this.thresholds.save(entity);
  }

  listThresholds(): Promise<SlaThreshold[]> {
    return this.thresholds.find({ order: { queueName: 'ASC' } });
  }

  async updateThreshold(
    id: string,
    dto: UpdateSlaThresholdDto,
  ): Promise<SlaThreshold> {
    const entity = await this.thresholds.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('SLA threshold not found');
    Object.assign(entity, dto);
    return this.thresholds.save(entity);
  }

  async removeThreshold(id: string): Promise<void> {
    const res = await this.thresholds.delete(id);
    if (!res.affected) throw new NotFoundException('SLA threshold not found');
  }

  async listAlerts(openOnly = false): Promise<MonitoringAlert[]> {
    return this.alerts.find({
      where: openOnly ? { resolvedAt: IsNull() } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /* --------------------------- SLA evaluator --------------------------- */

  /** Every 20s: compare live queue snapshots to thresholds, open/close alerts. */
  @Interval('sla-eval', 20_000)
  async evaluateSla(): Promise<void> {
    try {
      const thresholds = await this.thresholds.find({
        where: { isActive: true },
      });
      if (thresholds.length === 0) return;
      const live = await this.readQueues();
      const byQueue = new Map(live.map((q) => [q.queue, q]));

      for (const t of thresholds) {
        const q = byQueue.get(t.queueName);
        // No snapshot => treat as no waiting calls (resolve any open alerts).
        const breaches = q ? this.evaluate(q, t) : [];
        const breachTypes = new Set(breaches.map((b) => b.type));

        for (const b of breaches) await this.openAlert(t.queueName, b);

        // Resolve open alerts whose breach no longer holds.
        const open = await this.alerts.find({
          where: { queueName: t.queueName, resolvedAt: IsNull() },
        });
        for (const a of open) {
          if (!breachTypes.has(a.type as Breach['type'])) {
            await this.resolveAlert(a);
          }
        }
      }
    } catch (err) {
      this.logger.error(`SLA evaluation failed: ${(err as Error).message}`);
    }
  }

  /** Compute the set of active breaches for a queue against its threshold. */
  private evaluate(q: QueueLive, t: SlaThreshold): Breach[] {
    const breaches: Breach[] = [];
    const sev = (value: number, threshold: number): 'warning' | 'critical' =>
      threshold > 0 && value >= threshold * 2 ? 'critical' : 'warning';

    if (q.longestWait > t.maxWaitSec) {
      breaches.push({
        type: 'wait_exceeded',
        value: q.longestWait,
        threshold: t.maxWaitSec,
        severity: sev(q.longestWait, t.maxWaitSec),
        message: `${q.queue}: longest wait ${q.longestWait}s exceeds ${t.maxWaitSec}s`,
      });
    }
    if (q.calls > t.maxCallsWaiting) {
      breaches.push({
        type: 'backlog',
        value: q.calls,
        threshold: t.maxCallsWaiting,
        severity: sev(q.calls, t.maxCallsWaiting),
        message: `${q.queue}: ${q.calls} callers waiting (limit ${t.maxCallsWaiting})`,
      });
    }
    if (q.calls > 0 && q.membersAvailable < t.minAvailableAgents) {
      breaches.push({
        type: 'no_agents',
        value: q.membersAvailable,
        threshold: t.minAvailableAgents,
        severity: 'critical',
        message: `${q.queue}: ${q.membersAvailable} agents available with ${q.calls} waiting`,
      });
    }
    return breaches;
  }

  private async openAlert(queueName: string, b: Breach): Promise<void> {
    const existing = await this.alerts.findOne({
      where: { queueName, type: b.type, resolvedAt: IsNull() },
    });
    if (existing) return; // already firing — don't spam
    const alert = await this.alerts.save(
      this.alerts.create({
        queueName,
        type: b.type,
        severity: b.severity,
        message: b.message,
        value: b.value,
        threshold: b.threshold,
      }),
    );
    this.logger.warn(`SLA alert: ${b.message}`);
    await this.publish({
      kind: 'sla',
      event: 'alert',
      id: alert.id,
      queue: queueName,
      type: b.type,
      severity: b.severity,
      message: b.message,
      value: b.value,
      threshold: b.threshold,
      at: alert.createdAt,
    });
  }

  private async resolveAlert(a: MonitoringAlert): Promise<void> {
    a.resolvedAt = new Date();
    await this.alerts.save(a);
    await this.publish({
      kind: 'sla',
      event: 'resolved',
      id: a.id,
      queue: a.queueName,
      type: a.type,
      at: a.resolvedAt,
    });
  }

  private publish(payload: Record<string, unknown>): Promise<void> {
    return this.redis.publish(CHANNELS.MONITORING_EVENTS, payload);
  }

  /* ---------------------------- Redis readers -------------------------- */

  private async readQueues(): Promise<QueueLive[]> {
    const names = await this.redis.client.smembers(KEYS.queueIndex());
    const out: QueueLive[] = [];
    for (const name of names) {
      const h = await this.redis.client.hgetall(KEYS.queueSnapshot(name));
      if (!h || Object.keys(h).length === 0) continue;
      out.push({
        queue: h.queue || name,
        calls: this.toNum(h.calls),
        longestWait: this.toNum(h.longestWait),
        membersAvailable: this.toNum(h.membersAvailable),
        membersTotal: this.toNum(h.membersTotal),
        abandoned: this.toNum(h.abandoned),
        completed: this.toNum(h.completed),
      });
    }
    return out.sort((a, b) => a.queue.localeCompare(b.queue));
  }

  private async readAgents(): Promise<
    { extension: string; presence: string; reason: string }[]
  > {
    const exts = await this.redis.client.smembers(KEYS.agentIndex());
    const out: { extension: string; presence: string; reason: string }[] = [];
    for (const ext of exts) {
      const endpoint = await this.redis.client.hgetall(KEYS.endpointState(ext));
      const agent = await this.redis.client.hgetall(KEYS.agentState(ext));
      if (
        (!endpoint || Object.keys(endpoint).length === 0) &&
        (!agent || Object.keys(agent).length === 0)
      ) {
        continue;
      }
      out.push({
        extension: ext,
        presence: endpoint.presence || agent.presence || AgentPresence.OFFLINE,
        reason: agent.reason || endpoint.reason || '',
      });
    }
    return out.sort((a, b) => a.extension.localeCompare(b.extension));
  }
}
