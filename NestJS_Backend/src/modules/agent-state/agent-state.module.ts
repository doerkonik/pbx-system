import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentStateController } from './agent-state.controller';
import { AgentStateService } from './agent-state.service';
import { AgentPreference } from '../../database/entities';

/**
 * Agent self-service presence (DND + ACW). RedisService and LiveStateService
 * come from the global Redis/Telephony modules.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AgentPreference])],
  controllers: [AgentStateController],
  providers: [AgentStateService],
  exports: [AgentStateService],
})
export class AgentStateModule {}
