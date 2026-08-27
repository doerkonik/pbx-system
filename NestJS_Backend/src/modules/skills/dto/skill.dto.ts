import { PartialType } from '@nestjs/mapped-types';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class UpdateSkillDto extends PartialType(CreateSkillDto) {}

export class AssignAgentSkillDto {
  @Matches(/^[0-9]{2,10}$/, { message: 'extension must be 2-10 digits' })
  extension: string;

  @IsUUID()
  skillId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  level: number;
}

export class SetQueueSkillDto {
  @IsString()
  @MaxLength(128)
  queueName: string;

  @IsUUID()
  skillId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  minLevel?: number;
}
