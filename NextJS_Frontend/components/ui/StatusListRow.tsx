import { cn } from "@/lib/utils";
import { StatusPill, type StatusPillVariant } from "./StatusPill";

export interface StatusListRowProps {
  /** Primary name/label. */
  name: React.ReactNode;
  /** Optional secondary line under the name. */
  subtitle?: React.ReactNode;
  /** Optional leading element (avatar, icon, extension number). */
  leading?: React.ReactNode;
  /** Status pill variant. */
  status: StatusPillVariant;
  /** Override pill label. */
  statusLabel?: string;
  /** Animate the status dot. */
  pulse?: boolean;
  /** Trailing metric / duration text. */
  metric?: React.ReactNode;
  className?: string;
}

/** A row: (optional leading) name + StatusPill + trailing metric/duration. */
export function StatusListRow({
  name,
  subtitle,
  leading,
  status,
  statusLabel,
  pulse,
  metric,
  className,
}: StatusListRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-line py-2.5 last:border-0",
        className,
      )}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        {subtitle && (
          <p className="truncate text-xs text-ink-muted">{subtitle}</p>
        )}
      </div>
      <StatusPill variant={status} label={statusLabel} pulse={pulse} size="sm" />
      {metric != null && (
        <span className="ml-1 shrink-0 text-sm tabular-nums text-ink-muted">
          {metric}
        </span>
      )}
    </div>
  );
}
