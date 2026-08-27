import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoicemailController } from './voicemail.controller';
import { VoicemailService } from './voicemail.service';
import { VoicemailBox } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([VoicemailBox])],
  controllers: [VoicemailController],
  providers: [VoicemailService],
  exports: [VoicemailService],
})
export class VoicemailModule {}
