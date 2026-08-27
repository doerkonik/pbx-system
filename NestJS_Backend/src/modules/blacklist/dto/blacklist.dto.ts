import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { BlacklistDirection } from '../../../common/enums';

export class CreateBlacklistDto {
  @IsString()
  @Matches(/^\+?[0-9*#]{1,32}$/, {
    message: 'number must be a valid telephone number',
  })
  number: string;

  @IsOptional()
  @IsEnum(BlacklistDirection)
  direction?: BlacklistDirection;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBlacklistDto extends PartialType(CreateBlacklistDto) {}

/** Query for GET /blacklist/check. */
export class CheckBlacklistDto {
  @IsString()
  @Matches(/^\+?[0-9*#]{1,32}$/, {
    message: 'number must be a valid telephone number',
  })
  number: string;

  @IsEnum(BlacklistDirection)
  direction: BlacklistDirection;
}
