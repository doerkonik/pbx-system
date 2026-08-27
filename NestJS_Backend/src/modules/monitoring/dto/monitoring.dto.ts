import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { SpyMode } from '../../../common/enums';

/** Start a supervisor ChanSpy session on an agent's extension. */
export class SpyDto {
  @IsString()
  @MaxLength(40)
  targetExtension: string;

  @IsEnum(SpyMode)
  mode: SpyMode;
}

export class CreateSlaThresholdDto {
  @IsString()
  @MaxLength(128)
  queueName: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxWaitSec?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCallsWaiting?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAvailableAgents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  serviceLevelTargetSec?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSlaThresholdDto extends PartialType(CreateSlaThresholdDto) {}
