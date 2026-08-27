import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Force-hangup a live channel by its AMI channel name. */
export class HangupChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  channel: string;
}
