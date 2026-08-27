import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNotificationDto {
  /** Recipient; omit for a broadcast to all users. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  link?: string;

  /** Also email the recipient (ignored for broadcasts). */
  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

export class SendMessageDto {
  @IsUUID()
  toUserId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;
}

export class TestEmailDto {
  @IsEmail()
  to: string;
}
