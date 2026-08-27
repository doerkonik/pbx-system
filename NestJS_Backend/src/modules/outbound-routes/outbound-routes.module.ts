import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundRoutesController } from './outbound-routes.controller';
import { OutboundRoutesService } from './outbound-routes.service';
import { OutboundRoute, Trunk } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([OutboundRoute, Trunk])],
  controllers: [OutboundRoutesController],
  providers: [OutboundRoutesService],
  exports: [OutboundRoutesService],
})
export class OutboundRoutesModule {}
