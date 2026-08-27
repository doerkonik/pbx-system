import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MohController } from './moh.controller';
import { MohService } from './moh.service';
import { MohClass, MohFile } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([MohClass, MohFile])],
  controllers: [MohController],
  providers: [MohService],
  exports: [MohService],
})
export class MohModule {}
