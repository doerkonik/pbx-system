import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallbacksController } from './callbacks.controller';
import { CallbacksService } from './callbacks.service';
import { QueueCallback } from '../../database/entities';

/** Queue callbacks. TelephonyService comes from the global telephony module. */
@Module({
  imports: [TypeOrmModule.forFeature([QueueCallback])],
  controllers: [CallbacksController],
  providers: [CallbacksService],
  exports: [CallbacksService],
})
export class CallbacksModule {}
