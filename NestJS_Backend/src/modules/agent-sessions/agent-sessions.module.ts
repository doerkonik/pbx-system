import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentSessionsController } from './agent-sessions.controller';
import { AgentSessionsService } from './agent-sessions.service';
import { AgentSession } from '../../database/entities';

/** Agent login/logout session tracking (distinct from queue pause / breaks). */
@Module({
  imports: [TypeOrmModule.forFeature([AgentSession])],
  controllers: [AgentSessionsController],
  providers: [AgentSessionsService],
  exports: [AgentSessionsService],
})
export class AgentSessionsModule {}
