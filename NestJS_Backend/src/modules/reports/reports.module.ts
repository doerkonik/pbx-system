import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyAgentStats, DailyQueueStats } from '../../database/entities';
import { SchedulerModule } from '../../scheduler/scheduler.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Range reporting over the daily_* rollup tables. Imports SchedulerModule to
 * reuse RollupService for the admin manual-rollup endpoint.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DailyAgentStats, DailyQueueStats]),
    SchedulerModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
