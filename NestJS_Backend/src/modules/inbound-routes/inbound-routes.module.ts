import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboundRoutesController } from './inbound-routes.controller';
import { InboundRoutesService } from './inbound-routes.service';
import { InboundRoute } from '../../database/entities';
import { TimeRoutingModule } from '../time-routing/time-routing.module';

@Module({
  imports: [TypeOrmModule.forFeature([InboundRoute]), TimeRoutingModule],
  controllers: [InboundRoutesController],
  providers: [InboundRoutesService],
  exports: [InboundRoutesService],
})
export class InboundRoutesModule {}
