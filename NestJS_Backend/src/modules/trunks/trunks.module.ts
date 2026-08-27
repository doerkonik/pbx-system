import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrunksController } from './trunks.controller';
import { TrunksService } from './trunks.service';
import {
  PsAor,
  PsAuth,
  PsEndpoint,
  PsEndpointIdIp,
  PsRegistration,
  Trunk,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trunk,
      PsEndpoint,
      PsAuth,
      PsAor,
      PsEndpointIdIp,
      PsRegistration,
    ]),
  ],
  controllers: [TrunksController],
  providers: [TrunksService],
  exports: [TrunksService],
})
export class TrunksModule {}
