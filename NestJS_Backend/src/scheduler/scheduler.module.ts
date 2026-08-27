import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AgentSession,
  AgentStatusLog,
  Cdr,
  DailyAgentStats,
  DailyQueueStats,
  QueueLog,
  Recording,
  User,
} from '../database/entities';
import { RollupService } from './rollup.service';
import { RetentionService } from './retention.service';

/**
 * Background jobs. Nightly rollup of raw Asterisk data (cdr/queue_log) into the
 * daily_* aggregate tables that power range reports, plus recording retention.
 * RollupService is exported so ReportsController can offer a manual re-run.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cdr,
      QueueLog,
      AgentStatusLog,
      AgentSession,
      DailyAgentStats,
      DailyQueueStats,
      User,
      Recording,
    ]),
  ],
  providers: [RollupService, RetentionService],
  exports: [RollupService],
})
export class SchedulerModule {}
