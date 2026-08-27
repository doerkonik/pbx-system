import { BadRequestException } from '@nestjs/common';

/**
 * Values that end up in Asterisk realtime tables are later interpolated into
 * PJSIP config and dialplan by Asterisk itself. We must reject anything that
 * could break sorcery parsing or inject config directives. Keep this strict.
 */

const SAFE_ID = /^[A-Za-z0-9_\-.]{1,80}$/;
const SAFE_DIAL_TOKEN = /^[0-9A-Za-z_\-.*#+@]{1,64}$/;
const SAFE_NUMBER = /^\+?[0-9*#]{1,32}$/;

export function assertSafeAsteriskId(value: string, field = 'identifier'): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new BadRequestException(
      `${field} must match ${SAFE_ID} (letters, digits, _ - . only)`,
    );
  }
  return value;
}

export function assertSafeDialToken(value: string, field = 'value'): string {
  if (typeof value !== 'string' || !SAFE_DIAL_TOKEN.test(value)) {
    throw new BadRequestException(`${field} contains characters not allowed in dial context`);
  }
  return value;
}

export function assertSafeNumber(value: string, field = 'number'): string {
  const trimmed = (value ?? '').trim();
  if (!SAFE_NUMBER.test(trimmed)) {
    throw new BadRequestException(`${field} must be a valid telephone number`);
  }
  return trimmed;
}

/** For free-text like callerid names: strip control chars and Asterisk delimiters. */
export function sanitizeText(value: string, maxLen = 128): string {
  return (value ?? '')
    .replace(/[\r\n\t;,"'`$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}
