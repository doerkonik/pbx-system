import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateConferenceDto {
  /** ConfBridge room number Asterisk references — must be a safe Asterisk id. */
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'roomNumber must be 2-10 digits' })
  roomNumber: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** Optional PIN required for a regular participant to join. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{3,20}$/, { message: 'pin must be 3-20 digits' })
  pin?: string;

  /** Optional PIN that grants conference-admin privileges. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{3,20}$/, { message: 'adminPin must be 3-20 digits' })
  adminPin?: string;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  /** Music-on-hold class name played while the conference has a single member. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mohClass?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateConferenceDto extends PartialType(CreateConferenceDto) {}

/** Body for POST /conference/:id/participants — the extension to bring in. */
export class AddParticipantDto {
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'extension must be 2-10 digits' })
  extension: string;
}

/** Mute/unmute a participant (moderation). */
export class MuteParticipantDto {
  @IsBoolean()
  mute: boolean;
}

/** Lock/unlock a conference room against new joins. */
export class LockConferenceDto {
  @IsBoolean()
  locked: boolean;
}
