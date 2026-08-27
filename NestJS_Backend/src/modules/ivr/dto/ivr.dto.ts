import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IvrDestinationType } from '../../../common/enums';

/** A single DTMF option within an IVR menu. */
export class IvrEntryDto {
  /** DTMF digit(s) that trigger this entry, e.g. "1", "0", "#", "*". */
  @IsString()
  @Matches(/^[0-9*#]{1,8}$/, {
    message: 'digit must be 1-8 characters of 0-9, * or #',
  })
  digit: string;

  @IsEnum(IvrDestinationType)
  destType: IvrDestinationType;

  /** Required for every destType except `hangup` (validated in the service). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  destValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class CreateIvrMenuDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** Greeting sound file Asterisk plays on entry. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  greetingSound: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  digitTimeoutSec?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  /** Destination when the caller enters nothing / an invalid digit after retries. */
  @IsOptional()
  @IsEnum(IvrDestinationType)
  invalidDestType?: IvrDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invalidDestValue?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => IvrEntryDto)
  entries: IvrEntryDto[];
}

export class UpdateIvrMenuDto extends PartialType(CreateIvrMenuDto) {}
