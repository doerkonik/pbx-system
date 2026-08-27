import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RouteDestinationType } from '../../../common/enums';

export class CreateInboundRouteDto {
  @IsString()
  @MaxLength(80)
  name: string;

  /** DID to match. Omit/null for a catch-all (default) route. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  didNumber?: string;

  /** Optional caller-id match (exact or Asterisk-style `_X.` pattern). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cidPattern?: string;

  @IsEnum(RouteDestinationType)
  destType: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destValue?: string;

  @IsOptional()
  @IsEnum(RouteDestinationType)
  fallbackDestType?: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fallbackDestValue?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateInboundRouteDto extends PartialType(CreateInboundRouteDto) {}
