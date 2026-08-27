import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
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
  ValidateIf,
} from 'class-validator';
import { TrunkAuthType } from '../../../common/enums';

/** Comma-separated Asterisk codec list, e.g. `ulaw,alaw,opus`. */
const CODEC_LIST = /^[a-z0-9]+(,[a-z0-9]+)*$/i;
/** IPv4 host or CIDR, e.g. `203.0.113.4` or `203.0.113.0/24`. */
const IP_OR_CIDR =
  /^(\d{1,3}\.){3}\d{1,3}(\/([0-9]|[12][0-9]|3[0-2]))?$/;

export class CreateTrunkDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_\-.]{2,40}$/, {
    message: 'name must be 2-40 chars of letters, digits, _ - .',
  })
  name: string;

  @IsEnum(TrunkAuthType)
  authType: TrunkAuthType;

  /** Provider host/IP the trunk points at (goes into the AOR contact / registration URIs). */
  @IsString()
  @MaxLength(255)
  @Matches(/^[A-Za-z0-9_\-.]{1,255}$/, {
    message: 'sipServer must be a bare host or IP (no scheme, no port)',
  })
  sipServer: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  sipPort?: number;

  /** Required for REGISTRATION trunks (SIP auth user). */
  @ValidateIf((o) => o.authType === TrunkAuthType.REGISTRATION)
  @IsString()
  @MaxLength(120)
  @Matches(/^[A-Za-z0-9_\-.@]{1,120}$/, {
    message: 'username contains illegal characters',
  })
  username?: string;

  /** Required for REGISTRATION trunks (SIP auth secret). */
  @ValidateIf((o) => o.authType === TrunkAuthType.REGISTRATION)
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  password?: string;

  /** Required for IP-auth trunks: source IP or CIDR to match. */
  @ValidateIf((o) => o.authType === TrunkAuthType.IP)
  @IsString()
  @MaxLength(80)
  @Matches(IP_OR_CIDR, { message: 'matchIp must be an IPv4 address or CIDR' })
  matchIp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(CODEC_LIST, {
    message: 'codecs must be a comma-separated codec list',
  })
  codecs?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  failoverOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTrunkDto extends PartialType(CreateTrunkDto) {}
