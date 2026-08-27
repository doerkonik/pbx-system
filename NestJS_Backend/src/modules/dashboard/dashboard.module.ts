import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Read-only live-state snapshots for the realtime dashboard's initial load.
 * Reads exclusively from Redis (RedisService is global), so no TypeOrm/imports
 * are required here.
 */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
