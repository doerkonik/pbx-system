import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
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
import { RingGroupStrategy, RouteDestinationType } from '../../../common/enums';

export class CreateRingGroupDto {
  @Matches(/^[0-9]{2,10}$/, { message: 'number must be 2-10 digits' })
  number: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsEnum(RingGroupStrategy)
  strategy?: RingGroupStrategy;

  @IsArray()
  @ArrayMaxSize(50)
  @Matches(/^[0-9]{2,10}$/, { each: true, message: 'member must be 2-10 digits' })
  memberExtensions: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  ringTimeSec?: number;

  @IsOptional()
  @IsEnum(RouteDestinationType)
  noAnswerDestType?: RouteDestinationType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  noAnswerDestValue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  callerIdPrefix?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRingGroupDto extends PartialType(CreateRingGroupDto) {}
