import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
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
import { RouteDestinationType } from '../../../common/enums';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class TimeGroupRangeDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekdayStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekdayEnd?: number;

  @IsOptional()
  @Matches(HHMM, { message: 'timeStart must be HH:mm (24h)' })
  timeStart?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'timeEnd must be HH:mm (24h)' })
  timeEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthDayStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  monthDayEnd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthStart?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  monthEnd?: number;
}

export class CreateTimeGroupDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeGroupRangeDto)
  ranges: TimeGroupRangeDto[];
}

export class UpdateTimeGroupDto extends PartialType(CreateTimeGroupDto) {}

export class CreateTimeConditionDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsUUID()
  timeGroupId: string;

  @IsEnum(RouteDestinationType)
  matchDestType: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  matchDestValue?: string;

  @IsEnum(RouteDestinationType)
  noMatchDestType: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  noMatchDestValue?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTimeConditionDto extends PartialType(CreateTimeConditionDto) {}

export class CreateHolidayDto {
  @IsString()
  @MaxLength(80)
  name: string;

  /** ISO date (YYYY-MM-DD). When recurring, the year component is ignored. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsEnum(RouteDestinationType)
  destType: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destValue?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateHolidayDto extends PartialType(CreateHolidayDto) {}
