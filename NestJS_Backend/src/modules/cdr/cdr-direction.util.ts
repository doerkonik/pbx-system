import { SelectQueryBuilder } from 'typeorm';
import { Cdr } from '../../database/entities';
import { CallDirection } from '../../common/enums';

/**
 * Channels for internal endpoints look like `PJSIP/1001-0000000a` — the token
 * between the tech prefix and the dash is a bare extension number. Trunk
 * channels use a named endpoint (`PJSIP/mytrunk-...`), so a numeric endpoint is
 * our internal/external discriminator. Kept identical in JS and SQL below so
 * the derived label and the `direction` filter never disagree.
 */
const INTERNAL_CHANNEL_RE = /^(PJSIP|SIP|Local|IAX2)\/[0-9]{2,10}([-@]|$)/i;
const EXTENSION_NUMBER_RE = /^[0-9]{2,10}$/;

/** Postgres equivalents of the regexes above (case-insensitive for channels). */
const SQL_INTERNAL_CHANNEL = '^(PJSIP|SIP|Local|IAX2)/[0-9]{2,10}([-@]|$)';
const SQL_EXTENSION_NUMBER = '^[0-9]{2,10}$';

function isInternalChannel(channel: string | null | undefined): boolean {
  return INTERNAL_CHANNEL_RE.test(channel ?? '');
}

/**
 * Classify a CDR row as inbound / outbound / internal.
 *  - internal : an extension called another extension
 *  - outbound : an extension called out (dst is not an internal endpoint)
 *  - inbound  : the originating channel is not an internal endpoint
 */
export function deriveDirection(
  cdr: Pick<Cdr, 'channel' | 'dstchannel' | 'dst'>,
): CallDirection {
  const srcInternal = isInternalChannel(cdr.channel);
  let dstInternal = isInternalChannel(cdr.dstchannel);
  // Unanswered internal calls have no dstchannel; fall back to the dialed number.
  if (!cdr.dstchannel && EXTENSION_NUMBER_RE.test(cdr.dst ?? '')) {
    dstInternal = true;
  }

  if (!srcInternal) return CallDirection.INBOUND;
  return dstInternal ? CallDirection.INTERNAL : CallDirection.OUTBOUND;
}

/**
 * Apply the same classification as a SQL predicate on a Cdr query builder,
 * aliased `r`. Uses named params suffixed so it can be combined with others.
 */
export function applyDirectionFilter(
  qb: SelectQueryBuilder<Cdr>,
  direction: CallDirection,
): void {
  const params = {
    dirIntChan: SQL_INTERNAL_CHANNEL,
    dirExtNum: SQL_EXTENSION_NUMBER,
  };
  const srcInternal = `r.channel ~* :dirIntChan`;
  const dstInternal = `(r.dstchannel ~* :dirIntChan OR (r.dstchannel = '' AND r.dst ~ :dirExtNum))`;

  switch (direction) {
    case CallDirection.INBOUND:
      qb.andWhere(`NOT (${srcInternal})`, params);
      break;
    case CallDirection.OUTBOUND:
      qb.andWhere(`${srcInternal} AND NOT ${dstInternal}`, params);
      break;
    case CallDirection.INTERNAL:
      qb.andWhere(`${srcInternal} AND ${dstInternal}`, params);
      break;
  }
}
