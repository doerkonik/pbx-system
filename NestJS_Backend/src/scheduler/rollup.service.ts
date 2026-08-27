import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AgentPresence } from '../common/enums';
import {
  AgentSession,
  AgentStatusLog,
  Cdr,
  DailyAgentStats,
  DailyQueueStats,
  QueueLog,
  User,
} from '../database/entities';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Threshold (seconds) used for queue service-level: answered within N seconds. */
const SERVICE_LEVEL_THRESHOLD_SEC = 20;

/** Aggregated queue metrics for a single queue on a single day. */
interface QueueAggregate {
  statDate: string;
  queueName: string;
  offered: number;
  answered: number;
  abandoned: number;
  totalWaitSec: number;
  maxWaitSec: number;
  totalTalkSec: number;
  avgWaitSec: number;
  avgTalkSec: number;
  serviceLevelPct: string;
}

/**
 * Nightly rollup of raw Asterisk tables into daily_agent_stats / daily_queue_stats.
 * The heavy lifting lives in {@link rollupForDate}, which is idempotent (upsert on
 * the unique keys) so it can safely be re-run for any past date — used both by the
 * cron and the admin `POST /reports/rollup/run` endpoint.
 */
@Injectable()
export class RollupService {
  private readonly logger = new Logger(RollupService.name);

  constructor(
    @InjectRepository(Cdr)
    private readonly cdrRepo: Repository<Cdr>,
    @InjectRepository(QueueLog)
    private readonly queueLogRepo: Repository<QueueLog>,
    @InjectRepository(AgentStatusLog)
    private readonly statusRepo: Repository<AgentStatusLog>,
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
    @InjectRepository(DailyAgentStats)
    private readonly agentStatsRepo: Repository<DailyAgentStats>,
    @InjectRepository(DailyQueueStats)
    private readonly queueStatsRepo: Repository<DailyQueueStats>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Every day at 00:15 — aggregate the day that just ended. */
  @Cron('15 0 * * *')
  async runDailyRollup(): Promise<void> {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    this.logger.log(`Nightly rollup starting for ${dateStr}`);
    try {
      await this.rollupForDate(dateStr);
    } catch (err) {
      this.logger.error(
        `Nightly rollup failed for ${dateStr}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Aggregate a single calendar day (UTC) into both rollup tables. Idempotent —
   * re-running overwrites the previous rows for that date.
   */
  async rollupForDate(dateStr: string): Promise<void> {
    if (!DATE_RE.test(dateStr)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException(`Invalid date: ${dateStr}`);
    }
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    await this.rollupQueues(dateStr, start, end);
    await this.rollupAgents(dateStr, start, end);
    this.logger.log(`Rollup complete for ${dateStr}`);
  }

  // ---------------------------------------------------------------------------
  // Queue rollup
  // ---------------------------------------------------------------------------

  private async rollupQueues(
    dateStr: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const rows = await this.queueLogRepo.find({
      where: { time: Between(start, end) },
    });
    const aggregates = this.aggregateQueueLogs(rows, dateStr);
    for (const agg of aggregates) {
      await this.queueStatsRepo.upsert(agg, ['statDate', 'queueName']);
    }
    this.logger.log(
      `Queue rollup ${dateStr}: ${aggregates.length} queue(s) from ${rows.length} queue_log row(s)`,
    );
  }

  /**
   * Pure aggregation of queue_log rows into per-queue daily metrics. Kept free of
   * any DB access so it is directly unit-testable.
   *
   * Field semantics follow Asterisk queue_log:
   *  - ENTERQUEUE                → offered
   *  - CONNECT                   → answered; data1 = holdtime (wait before answer)
   *  - ABANDON                   → abandoned; data3 = waittime before hang-up
   *  - COMPLETECALLER/AGENT      → data2 = talktime
   */
  aggregateQueueLogs(rows: QueueLog[], dateStr: string): QueueAggregate[] {
    interface Acc {
      offered: number;
      answered: number;
      abandoned: number;
      totalWaitSec: number;
      maxWaitSec: number;
      totalTalkSec: number;
      talkCount: number;
      withinSl: number;
    }
    const groups = new Map<string, Acc>();
    const get = (queue: string): Acc => {
      let acc = groups.get(queue);
      if (!acc) {
        acc = {
          offered: 0,
          answered: 0,
          abandoned: 0,
          totalWaitSec: 0,
          maxWaitSec: 0,
          totalTalkSec: 0,
          talkCount: 0,
          withinSl: 0,
        };
        groups.set(queue, acc);
      }
      return acc;
    };
    const num = (v: string | null | undefined): number => {
      const n = parseInt((v ?? '').trim(), 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    for (const row of rows) {
      const queue = (row.queuename ?? '').trim();
      if (!queue || queue === 'NONE') continue;
      const acc = get(queue);
      switch (row.event) {
        case 'ENTERQUEUE':
          acc.offered += 1;
          break;
        case 'CONNECT': {
          const wait = num(row.data1);
          acc.answered += 1;
          acc.totalWaitSec += wait;
          acc.maxWaitSec = Math.max(acc.maxWaitSec, wait);
          if (wait <= SERVICE_LEVEL_THRESHOLD_SEC) acc.withinSl += 1;
          break;
        }
        case 'ABANDON': {
          const wait = num(row.data3);
          acc.abandoned += 1;
          acc.totalWaitSec += wait;
          acc.maxWaitSec = Math.max(acc.maxWaitSec, wait);
          break;
        }
        case 'COMPLETECALLER':
        case 'COMPLETEAGENT': {
          const talk = num(row.data2);
          acc.totalTalkSec += talk;
          acc.talkCount += 1;
          break;
        }
        default:
          break;
      }
    }

    const results: QueueAggregate[] = [];
    for (const [queueName, acc] of groups) {
      const waitSamples = acc.answered + acc.abandoned;
      const avgWaitSec =
        waitSamples > 0 ? Math.round(acc.totalWaitSec / waitSamples) : 0;
      const avgTalkSec =
        acc.talkCount > 0 ? Math.round(acc.totalTalkSec / acc.talkCount) : 0;
      const serviceLevelPct =
        acc.offered > 0
          ? ((acc.withinSl / acc.offered) * 100).toFixed(2)
          : '0.00';
      results.push({
        statDate: dateStr,
        queueName,
        offered: acc.offered,
        answered: acc.answered,
        abandoned: acc.abandoned,
        totalWaitSec: acc.totalWaitSec,
        maxWaitSec: acc.maxWaitSec,
        totalTalkSec: acc.totalTalkSec,
        avgWaitSec,
        avgTalkSec,
        serviceLevelPct,
      });
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Agent rollup
  // ---------------------------------------------------------------------------

  private async rollupAgents(
    dateStr: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const users = await this.userRepo.find();
    const agents = users.filter((u) => !!u.extension);
    let written = 0;

    for (const user of agents) {
      const ext = user.extension as string;
      const call = await this.aggregateAgentCalls(ext, start, end);
      const loginSec = await this.sumAgentLoginSec(user.id, start, end);
      const pauseSec = await this.sumAgentPauseSec(user.id, start, end);

      // Skip agents with no activity to keep the rollup table lean; still
      // idempotent because a re-run recomputes the same (absent) result.
      if (call.handled === 0 && loginSec === 0 && pauseSec === 0) continue;

      const avgHandleSec =
        call.answered > 0 ? Math.round(call.talkSec / call.answered) : 0;

      await this.agentStatsRepo.upsert(
        {
          statDate: dateStr,
          agentId: user.id,
          extension: ext,
          callsHandled: call.handled,
          callsAnswered: call.answered,
          callsMissed: call.missed,
          totalTalkSec: call.talkSec,
          // No reliable per-agent hold source in CDR; left at 0.
          totalHoldSec: 0,
          loginSec,
          pauseSec,
          avgHandleSec,
        },
        ['statDate', 'agentId'],
      );
      written += 1;
    }
    this.logger.log(
      `Agent rollup ${dateStr}: ${written} agent row(s) from ${agents.length} agent(s)`,
    );
  }

  private async aggregateAgentCalls(
    ext: string,
    start: Date,
    end: Date,
  ): Promise<{
    handled: number;
    answered: number;
    missed: number;
    talkSec: number;
  }> {
    const chan = `PJSIP/${ext}-%`;
    const raw = await this.cdrRepo
      .createQueryBuilder('c')
      .where('c.calldate >= :start AND c.calldate < :end', { start, end })
      .andWhere('(c.dstchannel LIKE :chan OR c.channel LIKE :chan)', { chan })
      .select('COUNT(*)', 'handled')
      .addSelect(
        `COUNT(*) FILTER (WHERE c.disposition = 'ANSWERED')`,
        'answered',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE c.disposition IN ('NO ANSWER','BUSY','FAILED','CONGESTION') AND c.dstchannel LIKE :chan)`,
        'missed',
      )
      .addSelect(
        `COALESCE(SUM(c.billsec) FILTER (WHERE c.disposition = 'ANSWERED'), 0)`,
        'talksec',
      )
      .getRawOne<{
        handled: string;
        answered: string;
        missed: string;
        talksec: string;
      }>();

    return {
      handled: parseInt(raw?.handled ?? '0', 10) || 0,
      answered: parseInt(raw?.answered ?? '0', 10) || 0,
      missed: parseInt(raw?.missed ?? '0', 10) || 0,
      talkSec: parseInt(raw?.talksec ?? '0', 10) || 0,
    };
  }

  private async sumAgentLoginSec(
    agentId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const raw = await this.sessionRepo
      .createQueryBuilder('s')
      .where('s.agentId = :agentId', { agentId })
      .andWhere('s.loginAt >= :start AND s.loginAt < :end', { start, end })
      .select('COALESCE(SUM(s.durationSec), 0)', 'total')
      .getRawOne<{ total: string }>();
    return parseInt(raw?.total ?? '0', 10) || 0;
  }

  private async sumAgentPauseSec(
    agentId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const raw = await this.statusRepo
      .createQueryBuilder('s')
      .where('s.agentId = :agentId', { agentId })
      .andWhere('s.status = :paused', { paused: AgentPresence.PAUSED })
      .andWhere('s.startedAt >= :start AND s.startedAt < :end', { start, end })
      .select('COALESCE(SUM(s.durationSec), 0)', 'total')
      .getRawOne<{ total: string }>();
    return parseInt(raw?.total ?? '0', 10) || 0;
  }
}
