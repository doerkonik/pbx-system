import { OmitType, PartialType } from '@nestjs/mapped-types';
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
} from 'class-validator';
import { QueueStrategy } from '../../../common/enums';

export class CreateQueueDto {
  /** Queue name — used as the realtime `queues` primary key and Asterisk id. */
  @IsString()
  @Matches(/^[A-Za-z0-9_\-.]{1,128}$/, {
    message: 'name must be 1-128 chars of letters, digits, _ - .',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsEnum(QueueStrategy)
  strategy?: QueueStrategy;

  /** Music-on-hold class (maps to `musiconhold` on the realtime row). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  mohClass?: string;

  /** Per-member ring timeout in seconds. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  timeout?: number;

  /** Seconds an agent is unavailable after finishing a queue call. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  wrapupTime?: number;

  /** Max callers allowed to wait (`maxlen`); 0 = unlimited. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  maxlen?: number;

  /** Ring members already on a call (`ringinuse`). */
  @IsOptional()
  @IsBoolean()
  ringinuse?: boolean;

  /** Max seconds a caller may wait before overflow (app-level metadata). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  maxWait?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  overflowDestType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  overflowDestValue?: string;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;
}

/** Update accepts every create field except the immutable `name`. */
export class UpdateQueueDto extends PartialType(
  OmitType(CreateQueueDto, ['name'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddQueueMemberDto {
  /** Extension number to enroll — becomes interface `PJSIP/<extension>`. */
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'extension must be 2-10 digits' })
  extension: string;

  /** Optional display name for the member; defaults to the extension. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  memberName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  penalty?: number;

  @IsOptional()
  @IsBoolean()
  paused?: boolean;
}
