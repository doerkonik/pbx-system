import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CallbackStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateQueueCallbackDto {
  @IsString()
  @MaxLength(128)
  queueName: string;

  @Matches(/^[0-9]{3,20}$/, { message: 'phone must be 3-20 digits' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  callerName?: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}

export class ListQueueCallbackQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  queueName?: string;

  @IsOptional()
  @IsEnum(CallbackStatus)
  status?: CallbackStatus;
}
