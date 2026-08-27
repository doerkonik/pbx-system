import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MiscDestinationType } from '../../../common/enums';

export class CreateMiscDestinationDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsEnum(MiscDestinationType)
  type: MiscDestinationType;

  /**
   * External number to dial (external_number) or announcement sound file
   * (announcement). Not used for hangup. Validated/sanitized per type in the
   * service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;
}

export class UpdateMiscDestinationDto extends PartialType(
  CreateMiscDestinationDto,
) {}
