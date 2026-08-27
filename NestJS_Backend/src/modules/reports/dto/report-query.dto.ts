import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Bucket size for range reports over the daily_* rollup tables. */
export enum ReportGranularity {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  /** Single aggregate bucket over the whole [from, to] range. */
  CUSTOM = 'custom',
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = 'must be a valid date in YYYY-MM-DD format';

/** Shared granularity + from/to query used by the range report endpoints. */
export class DateRangeQueryDto {
  @IsOptional()
  @IsEnum(ReportGranularity)
  granularity: ReportGranularity = ReportGranularity.DAY;

  @IsOptional()
  @Matches(DATE_RE, { message: `from ${DATE_MSG}` })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: `to ${DATE_MSG}` })
  to?: string;
}

export class AgentReportQueryDto extends DateRangeQueryDto {
  /** Admin-only filter. Agents are always forced to their own id. */
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

export class QueueReportQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  queue?: string;
}

/** Plain (ungrouped) range for the summary endpoint. */
export class SummaryQueryDto {
  @IsOptional()
  @Matches(DATE_RE, { message: `from ${DATE_MSG}` })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: `to ${DATE_MSG}` })
  to?: string;
}

export class RollupRunDto {
  @Matches(DATE_RE, { message: `date ${DATE_MSG}` })
  date: string;
}
