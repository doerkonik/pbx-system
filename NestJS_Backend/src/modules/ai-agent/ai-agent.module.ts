import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentConfig, AiCallReview, Cdr } from '../../database/entities';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';

/**
 * AI Studio: dashboard-driven management of the AVR/Gemini voice agent —
 * persona/model/voice (writes the AVR `.env`), dial-plan settings (regenerates
 * the included dialplan + AMI reload), container health/logs/restart, and
 * AI-call analytics from the tagged CDR rows. TelephonyService (AMI) comes from
 * the global TelephonyModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AiAgentConfig, AiCallReview, Cdr])],
  controllers: [AiAgentController],
  providers: [AiAgentService],
  exports: [AiAgentService],
})
export class AiAgentModule {}
