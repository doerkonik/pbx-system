import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RingGroupsController } from './ring-groups.controller';
import { RingGroupsService } from './ring-groups.service';
import { RingGroup } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([RingGroup])],
  controllers: [RingGroupsController],
  providers: [RingGroupsService],
  exports: [RingGroupsService],
})
export class RingGroupsModule {}
