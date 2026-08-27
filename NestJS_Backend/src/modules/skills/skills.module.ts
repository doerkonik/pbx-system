import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import {
  AgentSkill,
  QueueSkillRequirement,
  Skill,
} from '../../database/entities';
import { QueuesModule } from '../queues/queues.module';

/** Skill-based routing. Uses QueuesService to apply computed member penalties. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Skill, AgentSkill, QueueSkillRequirement]),
    QueuesModule,
  ],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule {}
