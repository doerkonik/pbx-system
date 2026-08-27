import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueuesController } from './queues.controller';
import { QueuesService } from './queues.service';
import {
  AstQueue,
  AstQueueMember,
  QueueConfig,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([AstQueue, AstQueueMember, QueueConfig]),
  ],
  controllers: [QueuesController],
  providers: [QueuesService],
  exports: [QueuesService],
})
export class QueuesModule {}
