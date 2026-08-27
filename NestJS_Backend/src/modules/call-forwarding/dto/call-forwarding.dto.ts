import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const FORWARD_TYPES = ['unconditional', 'busy', 'noanswer'] as const;
export type ForwardType = (typeof FORWARD_TYPES)[number];

/** Body for PUT /call-forwarding/:extensionNumber. */
export class SetCallForwardingDto {
  @IsBoolean()
  enabled: boolean;

  /**
   * Destination number/extension calls are forwarded to. Required (and validated
   * as a dial-safe number) when `enabled` is true.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  forwardTo?: string;

  @IsOptional()
  @IsIn(FORWARD_TYPES, {
    message: `forwardType must be one of: ${FORWARD_TYPES.join(', ')}`,
  })
  forwardType?: ForwardType;
}
