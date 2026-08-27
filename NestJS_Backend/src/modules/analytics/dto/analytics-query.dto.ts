import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MSG = 'must be a valid date in YYYY-MM-DD format';

/** Plain [from, to] range shared by the analytics endpoints. */
export class AnalyticsRangeDto {
  @IsOptional()
  @Matches(DATE_RE, { message: `from ${DATE_MSG}` })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: `to ${DATE_MSG}` })
  to?: string;
}

export class WaitDistributionDto extends AnalyticsRangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  queue?: string;
}

export class AgentUtilizationDto extends AnalyticsRangeDto {
  /** Admin-only filter. Agents are always forced to their own id. */
  @IsOptional()
  @IsUUID()
  agentId?: string;
}
