import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** Filters for the audit-log query endpoint. */
export class AuditQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  method?: string;

  /** ISO date-time lower bound (inclusive). */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** ISO date-time upper bound (inclusive). */
  @IsOptional()
  @IsISO8601()
  to?: string;
}
