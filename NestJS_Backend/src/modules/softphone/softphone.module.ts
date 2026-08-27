import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoftphoneController } from './softphone.controller';
import { PsAuth, Extension, Cdr } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([PsAuth, Extension, Cdr])],
  controllers: [SoftphoneController],
})
export class SoftphoneModule {}
