import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { StatusPill, type StatusPillVariant } from "./StatusPill";

export interface RosterRowProps {
  /** Agent full name. */
  name: string;
  /** Avatar image URL (falls back to initials). */
  avatarUrl?: string | null;
  /** Small stat under the name (e.g. "12 calls · 4:32 avg"). */
  stat?: React.ReactNode;
  /** Live presence status. */
  status: StatusPillVariant;
  statusLabel?: string;
  pulse?: boolean;
  /** Optional trailing content (duration, actions). */
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Roster row: avatar + name + small stat + live StatusPill. */
export function RosterRow({
  name,
  avatarUrl,
  stat,
  status,
  statusLabel,
  pulse,
  trailing,
  onClick,
  className,
}: RosterRowProps) {
  const avatarStatus =
    status === "idle"
      ? "success"
      : status === "offline" || status === "paused"
        ? "neutral"
        : status === "in_call" || status === "ringing" || status === "on_hold"
          ? "warn"
          : null;

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
        onClick && "hover:bg-surface-muted",
        className,
      )}
    >
      <Avatar name={name} src={avatarUrl} size="sm" status={avatarStatus} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        {stat && <p className="truncate text-xs text-ink-muted">{stat}</p>}
      </div>
      <StatusPill variant={status} label={statusLabel} pulse={pulse} size="sm" />
      {trailing != null && (
        <span className="shrink-0 text-sm tabular-nums text-ink-muted">
          {trailing}
        </span>
      )}
    </Wrapper>
  );
}
