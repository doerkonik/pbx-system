import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CampaignContactStatus,
  CampaignMode,
  CampaignStatus,
} from '../../../common/enums';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsEnum(CampaignMode)
  mode?: CampaignMode;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  callerId?: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class SetCampaignStatusDto {
  @IsEnum(CampaignStatus)
  status: CampaignStatus;
}

export class ContactDto {
  @IsString()
  @MaxLength(40)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class AddContactsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts: ContactDto[];
}

export class ContactOutcomeDto {
  /** Terminal contact status after the agent handled it. */
  @IsEnum(CampaignContactStatus)
  status: CampaignContactStatus;
}
