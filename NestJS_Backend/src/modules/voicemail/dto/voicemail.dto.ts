import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVoicemailDto {
  /** Mailbox number — typically the owning extension. */
  @Matches(/^[0-9]{2,10}$/, { message: 'mailbox must be 2-10 digits' })
  mailbox: string;

  /** Numeric voicemail PIN. */
  @Matches(/^[0-9]{4,10}$/, { message: 'pin must be 4-10 digits' })
  pin: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  /** Where voicemail-to-email notifications are sent. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Attach the recording to the notification email. */
  @IsOptional()
  @IsBoolean()
  attachToEmail?: boolean;

  /** Delete the message after emailing it (email-only mailbox). */
  @IsOptional()
  @IsBoolean()
  deleteAfterEmail?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxMessages?: number;
}

export class UpdateVoicemailDto extends PartialType(CreateVoicemailDto) {}
