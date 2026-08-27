import { IsString, MaxLength } from 'class-validator';

export class PingDto {
  /** Hostname or IP to ping (validated + shell-free in the service). */
  @IsString()
  @MaxLength(253)
  host: string;
}
