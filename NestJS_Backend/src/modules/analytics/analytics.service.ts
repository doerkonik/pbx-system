import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import {
  Cdr,
  DailyAgentStats,
  DailyQueueStats,
  QueueLog,
} from '../../database/entities';
import {
  AgentUtilizationDto,
  AnalyticsRangeDto,
  WaitDistributionDto,
} from './dto/analytics-query.dto';

interface DateRange {
  from: string;
  to: string;
  /** Exclusive upper bound as a Date for timestamptz comparisons. */
  fromDate: Date;
  toEnd: Date;
}

export interface WaitBucket {
  bucket: string;
  count: number;
}

export interface QueueAnswerRate {
  queue: string;
  offered: number;
  answered: number;
  abandoned: number;
  answerRatePct: number;
  abandonRatePct: number;
}

export interface PeakHour {
  hour: number;
  count: number;
}

export interface AgentUtilization {
  agentId: string;
  extension: string;
  talkSec: number;
  holdSec: number;
  loginSec: number;
  utilizationPct: number;
}

const toInt = (v: unknown): number => {
  const n = parseInt(String(v ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
};
const toFloat = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deeper aggregation on the rollup tables plus raw queue_log / cdr. Admin-scoped;
 * agent-utilization forces agents to their own id.
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(QueueLog)
    private readonly queueLogRepo: Repository<QueueLog>,
    @InjectRepository(DailyQueueStats)
    private readonly queueStatsRepo: Repository<DailyQueueStats>,
    @InjectRepository(DailyAgentStats)
    private readonly agentStatsRepo: Repository<DailyAgentStats>,
    @InjectRepository(Cdr)
    private readonly cdrRepo: Repository<Cdr>,
  ) {}

  /** Resolve/validate a [from, to] range, defaulting to the current month. */
  private resolveRange(from?: string, to?: string): DateRange {
    let f = from;
    let t = to;
    if (f && t) {
      if (f > t) {
        throw new BadRequestException('from must be on or before to');
      }
    } else if (f || t) {
      throw new BadRequestException('provide both from and to, or neither');
    } else {
      const today = new Date();
      const start = new Date(today);
      start.setUTCDate(1);
      f = start.toISOString().slice(0, 10);
      t = today.toISOString().slice(0, 10);
    }
    const fromDate = new Date(`${f}T00:00:00.000Z`);
    const toEnd = new Date(`${t}T00:00:00.000Z`);
    toEnd.setUTCDate(toEnd.getUTCDate() + 1); // inclusive end day
    return { from: f, to: t, fromDate, toEnd };
  }

  // ---------------------------------------------------------------------------
  // Wait-time distribution (raw queue_log)
  // ---------------------------------------------------------------------------

  async waitDistribution(query: WaitDistributionDto): Promise<{
    from: string;
    to: string;
    queue: string | null;
    buckets: WaitBucket[];
  }> {
    const range = this.resolveRange(query.from, query.to);
    // Wait is holdtime (data1) for CONNECT, waittime (data3) for ABANDON.
    const w = `CASE WHEN q.event = 'CONNECT' THEN NULLIF(q.data1, '')::int
                    WHEN q.event = 'ABANDON' THEN NULLIF(q.data3, '')::int END`;

    const qb = this.queueLogRepo
      .createQueryBuilder('q')
      .where("q.event IN ('CONNECT', 'ABANDON')")
      .andWhere('q.time >= :from AND q.time < :toEnd', {
        from: range.fromDate,
        toEnd: range.toEnd,
      });
    if (query.queue) {
      qb.andWhere('q.queuename = :queue', { queue: query.queue });
    }

    qb.select(`COUNT(*) FILTER (WHERE ${w} >= 0 AND ${w} < 10)`, 'b0_10')
      .addSelect(`COUNT(*) FILTER (WHERE ${w} >= 10 AND ${w} < 30)`, 'b10_30')
      .addSelect(`COUNT(*) FILTER (WHERE ${w} >= 30 AND ${w} < 60)`, 'b30_60')
      .addSelect(`COUNT(*) FILTER (WHERE ${w} >= 60 AND ${w} < 120)`, 'b60_120')
      .addSelect(`COUNT(*) FILTER (WHERE ${w} >= 120)`, 'b120');

    const raw = await qb.getRawOne<Record<string, string>>();
    const buckets: WaitBucket[] = [
      { bucket: '0-10s', count: toInt(raw?.b0_10) },
      { bucket: '10-30s', count: toInt(raw?.b10_30) },
      { bucket: '30-60s', count: toInt(raw?.b30_60) },
      { bucket: '60-120s', count: toInt(raw?.b60_120) },
      { bucket: '120s+', count: toInt(raw?.b120) },
    ];
    return { from: range.from, to: range.to, queue: query.queue ?? null, buckets };
  }

  // ---------------------------------------------------------------------------
  // Answer / abandon rates per queue (daily_queue_stats)
  // ---------------------------------------------------------------------------

  async answerRates(
    query: AnalyticsRangeDto,
  ): Promise<{ from: string; to: string; queues: QueueAnswerRate[] }> {
    const range = this.resolveRange(query.from, query.to);
    const raw = await this.queueStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', {
        from: range.from,
        to: range.to,
      })
      .select('s.queueName', 'queue')
      .addSelect('COALESCE(SUM(s.offered), 0)', 'offered')
      .addSelect('COALESCE(SUM(s.answered), 0)', 'answered')
      .addSelect('COALESCE(SUM(s.abandoned), 0)', 'abandoned')
      .groupBy('s.queueName')
      .orderBy('s.queueName', 'ASC')
      .getRawMany<Record<string, string>>();

    const queues: QueueAnswerRate[] = raw.map((r) => {
      const offered = toInt(r.offered);
      const answered = toInt(r.answered);
      const abandoned = toInt(r.abandoned);
      return {
        queue: String(r.queue),
        offered,
        answered,
        abandoned,
        answerRatePct: offered > 0 ? round2((answered / offered) * 100) : 0,
        abandonRatePct: offered > 0 ? round2((abandoned / offered) * 100) : 0,
      };
    });
    return { from: range.from, to: range.to, queues };
  }

  // ---------------------------------------------------------------------------
  // Peak hours (raw cdr)
  // ---------------------------------------------------------------------------

  async peakHours(
    query: AnalyticsRangeDto,
  ): Promise<{ from: string; to: string; hours: PeakHour[] }> {
    const range = this.resolveRange(query.from, query.to);
    const raw = await this.cdrRepo
      .createQueryBuilder('c')
      .where('c.calldate >= :from AND c.calldate < :toEnd', {
        from: range.fromDate,
        toEnd: range.toEnd,
      })
      .select('EXTRACT(HOUR FROM c.calldate)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .groupBy('EXTRACT(HOUR FROM c.calldate)')
      .getRawMany<{ hour: string; count: string }>();

    const counts = new Map<number, number>();
    for (const r of raw) counts.set(toInt(r.hour), toInt(r.count));

    const hours: PeakHour[] = [];
    for (let h = 0; h < 24; h += 1) {
      hours.push({ hour: h, count: counts.get(h) ?? 0 });
    }
    return { from: range.from, to: range.to, hours };
  }

  // ---------------------------------------------------------------------------
  // Agent utilization (daily_agent_stats)
  // ---------------------------------------------------------------------------

  async agentUtilization(
    query: AgentUtilizationDto,
    user: AuthenticatedUser,
  ): Promise<{
    from: string;
    to: string;
    agentId: string | null;
    agents: AgentUtilization[];
  }> {
    const range = this.resolveRange(query.from, query.to);
    const agentId =
      user.role === UserRole.AGENT ? user.sub : query.agentId ?? undefined;

    const qb = this.agentStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', {
        from: range.from,
        to: range.to,
      });
    if (agentId) qb.andWhere('s.agentId = :agentId', { agentId });

    const raw = await qb
      .select('s.agentId', 'agentId')
      .addSelect('MAX(s.extension)', 'extension')
      .addSelect('COALESCE(SUM(s.totalTalkSec), 0)', 'talk')
      .addSelect('COALESCE(SUM(s.totalHoldSec), 0)', 'hold')
      .addSelect('COALESCE(SUM(s.loginSec), 0)', 'login')
      .addSelect(
        `CASE WHEN SUM(s.loginSec) > 0
              THEN ROUND((SUM(s.totalTalkSec) + SUM(s.totalHoldSec))::numeric * 100 / SUM(s.loginSec), 2)
              ELSE 0 END`,
        'utilizationPct',
      )
      .groupBy('s.agentId')
      .orderBy('s.agentId', 'ASC')
      .getRawMany<Record<string, string>>();

    const agents: AgentUtilization[] = raw.map((r) => ({
      agentId: String(r.agentId),
      extension: String(r.extension ?? ''),
      talkSec: toInt(r.talk),
      holdSec: toInt(r.hold),
      loginSec: toInt(r.login),
      utilizationPct: round2(toFloat(r.utilizationPct)),
    }));
    return { from: range.from, to: range.to, agentId: agentId ?? null, agents };
  }
}
