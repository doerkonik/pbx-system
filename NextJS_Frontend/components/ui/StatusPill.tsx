import { cn } from "@/lib/utils";

/** Telephony presence states plus generic semantic tones. */
export type StatusPillVariant =
  | "idle"
  | "ringing"
  | "in_call"
  | "on_hold"
  | "paused"
  | "acw"
  | "dnd"
  | "offline"
  | "success"
  | "warn"
  | "danger"
  | "neutral";

export interface StatusPillProps {
  variant: StatusPillVariant;
  /** Override the default label for the variant. */
  label?: string;
  /** Show a small (optionally pulsing) leading dot. */
  dot?: boolean;
  /** Animate the dot — good for "ringing"/"in_call". */
  pulse?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const styles: Record<
  StatusPillVariant,
  { label: string; pill: string; dot: string }
> = {
  idle: {
    label: "Idle",
    pill: "bg-success-soft text-success",
    dot: "bg-success",
  },
  ringing: {
    label: "Ringing",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
  },
  in_call: {
    label: "In call",
    pill: "bg-info-soft text-info",
    dot: "bg-info",
  },
  on_hold: {
    label: "On hold",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
  },
  paused: {
    label: "Paused",
    pill: "bg-surface-muted text-ink-muted",
    dot: "bg-ink-subtle",
  },
  acw: {
    label: "Wrap-up",
    pill: "bg-warn-soft text-warn",
    dot: "bg-warn",
  },
  dnd: {
    label: "DND",
    pill: "bg-danger-soft text-danger",
    dot: "bg-danger",
  },
  offline: {
    label: "Offline",
    pill: "bg-surface-muted text-ink-subtle",
    dot: "bg-ink-subtle",
  },
  success: {
    label: "Success",
    pill: "bg-success-soft text-success",
    dot: "bg-success",
  },
  warn: { label: "Warning", pill: "bg-warn-soft text-warn", dot: "bg-warn" },
  danger: { label: "Danger", pill: "bg-danger-soft text-danger", dot: "bg-danger" },
  neutral: {
    label: "Neutral",
    pill: "bg-surface-muted text-ink-muted",
    dot: "bg-ink-subtle",
  },
};

/**
 * Colored status pill. Uses the semantic status palette (red/amber/green/blue)
 * — reserved for live data as per the design language.
 */
export function StatusPill({
  variant,
  label,
  dot = true,
  pulse = false,
  size = "md",
  className,
}: StatusPillProps) {
  const s = styles[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
        s.pill,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                s.dot,
                "animate-[pulse_1.4s_ease-in-out_infinite]",
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", s.dot)} />
        </span>
      )}
      {label ?? s.label}
    </span>
  );
}
