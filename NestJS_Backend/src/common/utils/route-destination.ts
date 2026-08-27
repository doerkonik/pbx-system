import { BadRequestException } from '@nestjs/common';
import { RouteDestinationType } from '../enums';
import { sanitizeText } from './asterisk-sanitize';

/**
 * Validate + sanitize a routing destination (type/value pair) used by inbound
 * routes, time conditions and holidays. `hangup` carries no value; every other
 * type requires a soft-reference value (extension number / queue name / ivr id
 * / time-condition id / conference room). Returns the sanitized value (or null
 * for hangup).
 */
export function assertRouteDest(
  type: RouteDestinationType | string,
  value: string | null | undefined,
  field = 'destination',
): string | null {
  if (type === RouteDestinationType.HANGUP) return null;
  if (!value) {
    throw new BadRequestException(
      `${field} value is required for a "${type}" destination`,
    );
  }
  return sanitizeText(value, 120);
}
