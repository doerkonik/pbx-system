import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MonitoringAlert, SlaThreshold } from '../../database/entities';

/**
 * Supervisor & monitoring (Module 6). TelephonyService + RedisService come from
 * their global modules; the SLA evaluator runs on an interval (ScheduleModule
 * is initialised in AppModule).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SlaThreshold, MonitoringAlert])],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
