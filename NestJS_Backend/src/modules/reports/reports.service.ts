import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { DailyAgentStats, DailyQueueStats } from '../../database/entities';
import {
  AgentReportQueryDto,
  QueueReportQueryDto,
  SummaryQueryDto,
} from './dto/report-query.dto';
import {
  bucketSelect,
  resolveRange,
  ResolvedRange,
  toCsv,
} from './reports.util';

export interface AgentReportBucket {
  bucket: string;
  callsHandled: number;
  callsAnswered: number;
  callsMissed: number;
  totalTalkSec: number;
  totalHoldSec: number;
  loginSec: number;
  pauseSec: number;
  avgHandleSec: number;
}

export interface AgentReport {
  granularity: string;
  from: string;
  to: string;
  agentId: string | null;
  data: AgentReportBucket[];
}

export interface QueueReportBucket {
  bucket: string;
  offered: number;
  answered: number;
  abandoned: number;
  totalWaitSec: number;
  maxWaitSec: number;
  totalTalkSec: number;
  avgWaitSec: number;
  avgTalkSec: number;
  serviceLevelPct: number;
}

export interface QueueReport {
  granularity: string;
  from: string;
  to: string;
  queue: string | null;
  data: QueueReportBucket[];
}

export interface CallSummary {
  from: string;
  to: string;
  callVolume: number;
  answered: number;
  abandoned: number;
  answerRatePct: number;
  avgHandleSec: number;
  serviceLevelPct: number;
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
 * Range reporting. Reads EXCLUSIVELY from the daily_* rollup tables (never raw
 * CDR) so reports stay cheap and consistent with the nightly aggregation.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(DailyAgentStats)
    private readonly agentStatsRepo: Repository<DailyAgentStats>,
    @InjectRepository(DailyQueueStats)
    private readonly queueStatsRepo: Repository<DailyQueueStats>,
  ) {}

  // ---------------------------------------------------------------------------
  // Agents
  // ---------------------------------------------------------------------------

  async agentReport(
    query: AgentReportQueryDto,
    user: AuthenticatedUser,
  ): Promise<AgentReport> {
    // Agents can only ever see their own numbers.
    const agentId =
      user.role === UserRole.AGENT ? user.sub : query.agentId ?? undefined;
    const range = resolveRange(query.granularity, query.from, query.to);
    const { select, group } = bucketSelect(query.granularity, 's.statDate');

    const qb = this.agentStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', range);
    if (agentId) qb.andWhere('s.agentId = :agentId', { agentId });

    qb.select(select ?? `'all'`, 'bucket')
      .addSelect('COALESCE(SUM(s.callsHandled), 0)', 'callsHandled')
      .addSelect('COALESCE(SUM(s.callsAnswered), 0)', 'callsAnswered')
      .addSelect('COALESCE(SUM(s.callsMissed), 0)', 'callsMissed')
      .addSelect('COALESCE(SUM(s.totalTalkSec), 0)', 'totalTalkSec')
      .addSelect('COALESCE(SUM(s.totalHoldSec), 0)', 'totalHoldSec')
      .addSelect('COALESCE(SUM(s.loginSec), 0)', 'loginSec')
      .addSelect('COALESCE(SUM(s.pauseSec), 0)', 'pauseSec')
      .addSelect(
        `CASE WHEN SUM(s.callsAnswered) > 0
              THEN ROUND(SUM(s.totalTalkSec)::numeric / SUM(s.callsAnswered))
              ELSE 0 END`,
        'avgHandleSec',
      );

    if (group) {
      qb.groupBy(group).orderBy(group, 'ASC');
    }

    const raw = await qb.getRawMany();
    return {
      granularity: query.granularity,
      from: range.from,
      to: range.to,
      agentId: agentId ?? null,
      data: raw.map((r) => this.mapAgentBucket(r)),
    };
  }

  private mapAgentBucket(r: Record<string, unknown>): AgentReportBucket {
    return {
      bucket: String(r.bucket ?? 'all'),
      callsHandled: toInt(r.callsHandled),
      callsAnswered: toInt(r.callsAnswered),
      callsMissed: toInt(r.callsMissed),
      totalTalkSec: toInt(r.totalTalkSec),
      totalHoldSec: toInt(r.totalHoldSec),
      loginSec: toInt(r.loginSec),
      pauseSec: toInt(r.pauseSec),
      avgHandleSec: toInt(r.avgHandleSec),
    };
  }

  async agentReportCsv(
    query: AgentReportQueryDto,
    user: AuthenticatedUser,
  ): Promise<string> {
    const report = await this.agentReport(query, user);
    return toCsv(
      [
        'bucket',
        'callsHandled',
        'callsAnswered',
        'callsMissed',
        'totalTalkSec',
        'totalHoldSec',
        'loginSec',
        'pauseSec',
        'avgHandleSec',
      ],
      report.data.map((b) => [
        b.bucket,
        b.callsHandled,
        b.callsAnswered,
        b.callsMissed,
        b.totalTalkSec,
        b.totalHoldSec,
        b.loginSec,
        b.pauseSec,
        b.avgHandleSec,
      ]),
    );
  }

  // ---------------------------------------------------------------------------
  // Queues (admin only)
  // ---------------------------------------------------------------------------

  async queueReport(query: QueueReportQueryDto): Promise<QueueReport> {
    const range = resolveRange(query.granularity, query.from, query.to);
    const { select, group } = bucketSelect(query.granularity, 's.statDate');

    const qb = this.queueStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', range);
    if (query.queue) qb.andWhere('s.queueName = :queue', { queue: query.queue });

    qb.select(select ?? `'all'`, 'bucket')
      .addSelect('COALESCE(SUM(s.offered), 0)', 'offered')
      .addSelect('COALESCE(SUM(s.answered), 0)', 'answered')
      .addSelect('COALESCE(SUM(s.abandoned), 0)', 'abandoned')
      .addSelect('COALESCE(SUM(s.totalWaitSec), 0)', 'totalWaitSec')
      .addSelect('COALESCE(MAX(s.maxWaitSec), 0)', 'maxWaitSec')
      .addSelect('COALESCE(SUM(s.totalTalkSec), 0)', 'totalTalkSec')
      .addSelect(
        `CASE WHEN SUM(s.answered) + SUM(s.abandoned) > 0
              THEN ROUND(SUM(s.totalWaitSec)::numeric / (SUM(s.answered) + SUM(s.abandoned)))
              ELSE 0 END`,
        'avgWaitSec',
      )
      .addSelect(
        `CASE WHEN SUM(s.answered) > 0
              THEN ROUND(SUM(s.totalTalkSec)::numeric / SUM(s.answered))
              ELSE 0 END`,
        'avgTalkSec',
      )
      // Weighted service level: reconstruct within-SL count from stored pct.
      .addSelect(
        `CASE WHEN SUM(s.offered) > 0
              THEN ROUND(SUM(s.serviceLevelPct * s.offered)::numeric / SUM(s.offered), 2)
              ELSE 0 END`,
        'serviceLevelPct',
      );

    if (group) {
      qb.groupBy(group).orderBy(group, 'ASC');
    }

    const raw = await qb.getRawMany();
    return {
      granularity: query.granularity,
      from: range.from,
      to: range.to,
      queue: query.queue ?? null,
      data: raw.map((r) => this.mapQueueBucket(r)),
    };
  }

  private mapQueueBucket(r: Record<string, unknown>): QueueReportBucket {
    return {
      bucket: String(r.bucket ?? 'all'),
      offered: toInt(r.offered),
      answered: toInt(r.answered),
      abandoned: toInt(r.abandoned),
      totalWaitSec: toInt(r.totalWaitSec),
      maxWaitSec: toInt(r.maxWaitSec),
      totalTalkSec: toInt(r.totalTalkSec),
      avgWaitSec: toInt(r.avgWaitSec),
      avgTalkSec: toInt(r.avgTalkSec),
      serviceLevelPct: round2(toFloat(r.serviceLevelPct)),
    };
  }

  async queueReportCsv(query: QueueReportQueryDto): Promise<string> {
    const report = await this.queueReport(query);
    return toCsv(
      [
        'bucket',
        'offered',
        'answered',
        'abandoned',
        'totalWaitSec',
        'maxWaitSec',
        'totalTalkSec',
        'avgWaitSec',
        'avgTalkSec',
        'serviceLevelPct',
      ],
      report.data.map((b) => [
        b.bucket,
        b.offered,
        b.answered,
        b.abandoned,
        b.totalWaitSec,
        b.maxWaitSec,
        b.totalTalkSec,
        b.avgWaitSec,
        b.avgTalkSec,
        b.serviceLevelPct,
      ]),
    );
  }

  // ---------------------------------------------------------------------------
  // Summary (admin only)
  // ---------------------------------------------------------------------------

  async summary(query: SummaryQueryDto): Promise<CallSummary> {
    // Reuse the CUSTOM path if both provided, else default to current month.
    const range = this.resolveSummaryRange(query.from, query.to);

    const queueRaw = await this.queueStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', range)
      .select('COALESCE(SUM(s.offered), 0)', 'offered')
      .addSelect('COALESCE(SUM(s.answered), 0)', 'answered')
      .addSelect('COALESCE(SUM(s.abandoned), 0)', 'abandoned')
      .addSelect(
        `CASE WHEN SUM(s.offered) > 0
              THEN ROUND(SUM(s.serviceLevelPct * s.offered)::numeric / SUM(s.offered), 2)
              ELSE 0 END`,
        'sla',
      )
      .getRawOne<{
        offered: string;
        answered: string;
        abandoned: string;
        sla: string;
      }>();

    const agentRaw = await this.agentStatsRepo
      .createQueryBuilder('s')
      .where('s.statDate >= :from AND s.statDate <= :to', range)
      .select('COALESCE(SUM(s.totalTalkSec), 0)', 'talk')
      .addSelect('COALESCE(SUM(s.callsAnswered), 0)', 'answered')
      .getRawOne<{ talk: string; answered: string }>();

    const offered = toInt(queueRaw?.offered);
    const answered = toInt(queueRaw?.answered);
    const abandoned = toInt(queueRaw?.abandoned);
    const agentTalk = toInt(agentRaw?.talk);
    const agentAnswered = toInt(agentRaw?.answered);

    return {
      from: range.from,
      to: range.to,
      callVolume: offered,
      answered,
      abandoned,
      answerRatePct: offered > 0 ? round2((answered / offered) * 100) : 0,
      avgHandleSec:
        agentAnswered > 0 ? Math.round(agentTalk / agentAnswered) : 0,
      serviceLevelPct: round2(toFloat(queueRaw?.sla)),
    };
  }

  private resolveSummaryRange(from?: string, to?: string): ResolvedRange {
    if (from && to) {
      if (from > to) {
        throw new BadRequestException('from must be on or before to');
      }
      return { from, to };
    }
    if (from || to) {
      throw new BadRequestException('provide both from and to, or neither');
    }
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(1);
    return {
      from: start.toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    };
  }
}
