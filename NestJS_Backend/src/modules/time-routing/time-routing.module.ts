import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeRoutingController } from './time-routing.controller';
import { TimeRoutingService } from './time-routing.service';
import {
  Holiday,
  TimeCondition,
  TimeGroup,
  TimeGroupRange,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeGroup, TimeGroupRange, TimeCondition, Holiday]),
  ],
  controllers: [TimeRoutingController],
  providers: [TimeRoutingService],
  exports: [TimeRoutingService],
})
export class TimeRoutingModule {}
