import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BreaksController } from './breaks.controller';
import { BreaksService } from './breaks.service';
import { AgentStatusLog, BreakReasonConfig } from '../../database/entities';

/**
 * Agent break / queue-pause with dual-write to agent_status_log, plus
 * admin-configurable break reasons. TelephonyService is provided globally.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AgentStatusLog, BreakReasonConfig])],
  controllers: [BreaksController],
  providers: [BreaksService],
  exports: [BreaksService],
})
export class BreaksModule {}
