import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/* ------------------------------- Forms ------------------------------- */

export class QaQuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  section?: string;

  @IsString()
  @MaxLength(400)
  text: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateQaFormDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QaQuestionDto)
  questions: QaQuestionDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateQaFormDto extends PartialType(CreateQaFormDto) {}

/* ---------------------------- Evaluations ---------------------------- */

export class CreateEvaluationDto {
  @IsUUID()
  formId: string;

  @IsString()
  @MaxLength(150)
  uniqueid: string;

  @IsOptional()
  @Matches(/^[0-9]{2,10}$/, { message: 'agentExtension must be 2-10 digits' })
  agentExtension?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  /** User assigned to perform the evaluation. */
  @IsUUID()
  evaluatorId: string;
}

export class ScoreItemDto {
  @IsUUID()
  questionId: string;

  @IsInt()
  @Min(0)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class SubmitScoresDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ScoreItemDto)
  scores: ScoreItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

/* ----------------------------- Call notes ---------------------------- */

export class CreateCallNoteDto {
  @IsString()
  @MaxLength(4000)
  note: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
}
