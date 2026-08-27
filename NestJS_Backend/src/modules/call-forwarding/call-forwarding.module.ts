import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallForwardingController } from './call-forwarding.controller';
import { CallForwardingService } from './call-forwarding.service';
import { CallForwarding } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([CallForwarding])],
  controllers: [CallForwardingController],
  providers: [CallForwardingService],
  exports: [CallForwardingService],
})
export class CallForwardingModule {}
