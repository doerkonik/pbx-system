import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDidDto {
  /** DID number as delivered by the provider (E.164 or provider format). */
  @IsString()
  @MaxLength(40)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /** Trunk (trunks.id) this DID arrives on, if pinned to a provider. */
  @IsOptional()
  @IsUUID()
  trunkId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDidDto extends PartialType(CreateDidDto) {}
