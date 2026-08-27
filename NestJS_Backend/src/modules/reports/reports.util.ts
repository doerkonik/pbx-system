import { BadRequestException } from '@nestjs/common';
import { ReportGranularity } from './dto/report-query.dto';

export interface ResolvedRange {
  from: string;
  to: string;
}

const fmt = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Resolve granularity + optional from/to into a concrete [from, to] date range.
 * When from/to are omitted they default relative to today based on granularity.
 * `custom` requires both bounds. Always validates from <= to.
 */
export function resolveRange(
  granularity: ReportGranularity,
  from?: string,
  to?: string,
): ResolvedRange {
  let range: ResolvedRange;

  if (granularity === ReportGranularity.CUSTOM) {
    if (!from || !to) {
      throw new BadRequestException(
        'custom granularity requires both from and to',
      );
    }
    range = { from, to };
  } else if (from && to) {
    range = { from, to };
  } else if (from || to) {
    throw new BadRequestException('provide both from and to, or neither');
  } else {
    const today = new Date();
    const toStr = fmt(today);
    const start = new Date(today);
    switch (granularity) {
      case ReportGranularity.WEEK:
        start.setUTCDate(start.getUTCDate() - 6);
        break;
      case ReportGranularity.MONTH:
        start.setUTCDate(1);
        break;
      case ReportGranularity.YEAR:
        start.setUTCMonth(0, 1);
        break;
      case ReportGranularity.DAY:
      default:
        break;
    }
    range = { from: fmt(start), to: toStr };
  }

  if (range.from > range.to) {
    throw new BadRequestException('from must be on or before to');
  }
  return range;
}

export interface BucketSelect {
  /** SQL expression producing the bucket label, or null for a single bucket. */
  select: string | null;
  /** SQL expression to GROUP BY / ORDER BY, or null when not grouping. */
  group: string | null;
}

/**
 * SQL expressions that turn a date column into a bucket label for the given
 * granularity. `custom` collapses the whole range into one row (no grouping).
 */
export function bucketSelect(
  granularity: ReportGranularity,
  col: string,
): BucketSelect {
  switch (granularity) {
    case ReportGranularity.WEEK: {
      const expr = `to_char(date_trunc('week', ${col}::timestamp), 'IYYY-"W"IW')`;
      return { select: expr, group: expr };
    }
    case ReportGranularity.MONTH: {
      const expr = `to_char(${col}, 'YYYY-MM')`;
      return { select: expr, group: expr };
    }
    case ReportGranularity.YEAR: {
      const expr = `to_char(${col}, 'YYYY')`;
      return { select: expr, group: expr };
    }
    case ReportGranularity.CUSTOM:
      return { select: null, group: null };
    case ReportGranularity.DAY:
    default: {
      const expr = `to_char(${col}, 'YYYY-MM-DD')`;
      return { select: expr, group: expr };
    }
  }
}

/** Escape a single CSV field per RFC 4180. */
export function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV document (CRLF line endings) from a header + row matrix. */
export function toCsv(
  headers: string[],
  rows: Array<Array<string | number>>,
): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
