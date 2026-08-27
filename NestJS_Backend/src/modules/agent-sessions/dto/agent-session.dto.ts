import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** History listing: agents see their own; admin may target any agent. */
export class SessionHistoryQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  agentId?: string;
}

/** Login body. `deviceExtension` set = hot-desk onto a different station. */
export class AgentLoginDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  deviceExtension?: string;
}
