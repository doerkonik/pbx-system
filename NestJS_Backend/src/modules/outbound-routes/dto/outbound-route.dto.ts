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
  MaxLength,
  Min,
} from 'class-validator';

export class CreateOutboundRouteDto {
  @IsString()
  @MaxLength(80)
  name: string;

  /** Asterisk dial pattern, e.g. `_9NXXXXXXXXX`, or a literal prefix. */
  @IsString()
  @MaxLength(120)
  @Matches(/^[0-9A-Za-z_\-.*#+@]{1,120}$/, {
    message: 'pattern contains characters not allowed in a dial pattern',
  })
  pattern: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9*#+]{1,40}$/, {
    message: 'prefix must be digits or * # +',
  })
  prefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stripDigits?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  callerIdOverride?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  /** Ordered trunk ids to try (failover). Must reference existing trunks. */
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  trunkIds: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOutboundRouteDto extends PartialType(
  CreateOutboundRouteDto,
) {}
