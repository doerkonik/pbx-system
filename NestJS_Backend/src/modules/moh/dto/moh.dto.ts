import { PartialType } from '@nestjs/mapped-types';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * A MoH class groups the audio files Asterisk streams while a caller is on hold.
 * `name` is the class id Asterisk references (musiconhold.conf / realtime), so it
 * must be a safe Asterisk identifier. `directory` is the on-disk path on VM1 where
 * the audio files live.
 */
export class CreateMohClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  /** Asterisk MoH mode. `files` is by far the most common. */
  @IsOptional()
  @IsIn(['files', 'custom', 'mp3', 'quietmp3', 'playlist'])
  mode?: string;

  /** Absolute path on VM1's shared MoH directory where the audio files reside. */
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  directory: string;

  /** Audio format Asterisk should stream (wav, ulaw, alaw, gsm, ...). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  format?: string;
}

export class UpdateMohClassDto extends PartialType(CreateMohClassDto) {}

/**
 * Registers metadata for an audio file that has ALREADY been placed on VM1's
 * shared MoH directory (the physical upload/placement is an ops step documented
 * in asterisk_configuration.md). We only persist the metadata Asterisk reads.
 */
export class RegisterMohFileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  filePath: string;
}
