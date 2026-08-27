import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispositionsController } from './dispositions.controller';
import { DispositionsService } from './dispositions.service';
import { CallDisposition, DispositionCode } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([DispositionCode, CallDisposition])],
  controllers: [DispositionsController],
  providers: [DispositionsService],
  exports: [DispositionsService],
})
export class DispositionsModule {}
