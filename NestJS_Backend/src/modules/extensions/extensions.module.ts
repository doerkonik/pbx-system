import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtensionsController } from './extensions.controller';
import { ExtensionsService } from './extensions.service';
import {
  Extension,
  PsAor,
  PsAuth,
  PsEndpoint,
} from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Extension, PsEndpoint, PsAuth, PsAor]),
  ],
  controllers: [ExtensionsController],
  providers: [ExtensionsService],
  exports: [ExtensionsService],
})
export class ExtensionsModule {}
