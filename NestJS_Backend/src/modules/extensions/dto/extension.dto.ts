import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExtensionDto {
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'extensionNumber must be 2-10 digits' })
  extensionNumber: string;

  /** SIP auth secret for the endpoint. Required on create. */
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  secret: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  department?: string;

  /** Enable WebRTC (browser softphone) — sets webrtc=yes on the PJSIP endpoint. */
  @IsOptional()
  @IsBoolean()
  webrtc?: boolean;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  callGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  pickupGroup?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateExtensionDto extends PartialType(CreateExtensionDto) {}
