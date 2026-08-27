import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Cdr,
  DailyAgentStats,
  DailyQueueStats,
  QueueLog,
} from '../../database/entities';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

/**
 * Deeper call-centre analytics: wait distribution and peak hours from raw
 * queue_log / cdr, answer rates and agent utilization from the daily_* rollups.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      QueueLog,
      DailyQueueStats,
      DailyAgentStats,
      Cdr,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
