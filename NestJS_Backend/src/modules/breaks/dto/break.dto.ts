import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class StartBreakDto {
  /** Code of a configured, active break reason (see break_reasons). */
  @IsString()
  @MaxLength(40)
  reason: string;

  /** Optional queue to pause within; omit to pause across all queues. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  queue?: string;
}

export class EndBreakDto {
  /** Optional queue to unpause within; must match the queue paused on start. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  queue?: string;
}

/** History listing: agents see their own; admin may target any agent. */
export class BreakHistoryQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

/** Admin-managed break reason. */
export class CreateBreakReasonDto {
  @IsString()
  @Matches(/^[a-z0-9_-]{2,40}$/, {
    message: 'code must be 2-40 chars: lowercase letters, digits, _ or -',
  })
  code: string;

  @IsString()
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateBreakReasonDto extends PartialType(CreateBreakReasonDto) {}
