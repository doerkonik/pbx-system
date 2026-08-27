import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QaController } from './qa.controller';
import { QaService } from './qa.service';
import {
  CallNote,
  QaEvaluation,
  QaForm,
  QaQuestion,
  QaScore,
} from '../../database/entities';

/** Quality assurance (Module 9): scorecards, evaluations, coaching notes. */
@Module({
  imports: [
    TypeOrmModule.forFeature([QaForm, QaQuestion, QaEvaluation, QaScore, CallNote]),
  ],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
