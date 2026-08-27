import { Module } from '@nestjs/common';
import { CallControlController } from './call-control.controller';
import { CallControlService } from './call-control.service';

/**
 * Agent-triggered live call actions (originate/answer/hangup/hold/transfer/
 * park/record) plus a live parked-call listing. RedisService and
 * TelephonyService are provided globally, so no imports are required here.
 */
@Module({
  controllers: [CallControlController],
  providers: [CallControlService],
  exports: [CallControlService],
})
export class CallControlModule {}
