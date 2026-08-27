import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MiscDestinationsController } from './misc-destinations.controller';
import { MiscDestinationsService } from './misc-destinations.service';
import { MiscDestination } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([MiscDestination])],
  controllers: [MiscDestinationsController],
  providers: [MiscDestinationsService],
  exports: [MiscDestinationsService],
})
export class MiscDestinationsModule {}
