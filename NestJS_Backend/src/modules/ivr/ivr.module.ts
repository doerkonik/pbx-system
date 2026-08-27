import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IvrController } from './ivr.controller';
import { IvrService } from './ivr.service';
import { IvrEntry, IvrMenu } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([IvrMenu, IvrEntry])],
  controllers: [IvrController],
  providers: [IvrService],
  exports: [IvrService],
})
export class IvrModule {}
