import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DispositionCategory } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateDispositionCodeDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsString()
  @MaxLength(120)
  label: string;

  @IsEnum(DispositionCategory)
  category: DispositionCategory;

  @IsOptional()
  @IsBoolean()
  requiresNote?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDispositionCodeDto extends PartialType(
  CreateDispositionCodeDto,
) {}

/** Filter for the supervisor disposition log. */
export class ListDispositionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  uniqueid?: string;
}

/** Submitted by an agent during after-call work for a specific call. */
export class SubmitDispositionDto {
  @IsUUID()
  dispositionCodeId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  acwSec?: number;
}
