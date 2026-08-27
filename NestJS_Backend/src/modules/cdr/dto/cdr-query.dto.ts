import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CallDirection } from '../../../common/enums';

/** Filters for the read-only CDR search endpoint. */
export class QueryCdrDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  src?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  disposition?: string;

  @IsOptional()
  @IsEnum(CallDirection)
  direction?: CallDirection;

  /** Inclusive lower bound on calldate (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Inclusive upper bound on calldate (ISO-8601). */
  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDuration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxDuration?: number;
}
