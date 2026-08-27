import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConferenceController } from './conference.controller';
import { ConferenceService } from './conference.service';
import { Conference } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Conference])],
  controllers: [ConferenceController],
  providers: [ConferenceService],
  exports: [ConferenceService],
})
export class ConferenceModule {}
