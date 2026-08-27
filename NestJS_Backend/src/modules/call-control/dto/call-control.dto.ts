import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { TransferType } from '../../../common/enums';

/** Click-to-dial from an agent's own extension (admin may target another). */
export class OriginateDto {
  /** Destination number / extension to dial. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  to: string;

  /** Optional caller id override (free text, sanitized server-side). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  callerId?: string;

  /** Admin-only: originate from a specific extension. Ignored for agents. */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'fromExtension must be 2-10 digits' })
  fromExtension?: string;
}

/** Actions addressed by ARI channel id / uniqueid. */
export class ChannelIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  channelId: string;
}

/** Actions addressed by AMI channel name, e.g. `PJSIP/1001-00000abc`. */
export class ChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  channel: string;
}

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  channel: string;

  /** Transfer target extension / number. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  to: string;

  @IsEnum(TransferType)
  type: TransferType;
}

export class ParkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  channel: string;

  /** Optional channel that should hear the parking-slot announcement. */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  announceChannel?: string;
}

/** Directed call pickup: answer a call ringing at another extension. */
export class PickupDto {
  @IsString()
  @Matches(/^[0-9]{2,10}$/, { message: 'targetExtension must be 2-10 digits' })
  targetExtension: string;
}
