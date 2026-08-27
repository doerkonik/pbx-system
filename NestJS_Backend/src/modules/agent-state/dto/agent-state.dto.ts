import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetDndDto {
  @IsBoolean()
  on: boolean;
}

export class SetAcwDto {
  @IsBoolean()
  on: boolean;

  /** Optional wrap-up window hint (seconds) surfaced to the UI/dashboard. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds?: number;
}
