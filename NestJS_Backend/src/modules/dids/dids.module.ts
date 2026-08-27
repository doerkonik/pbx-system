import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DidsController } from './dids.controller';
import { DidsService } from './dids.service';
import { Did } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Did])],
  controllers: [DidsController],
  providers: [DidsService],
  exports: [DidsService],
})
export class DidsModule {}
