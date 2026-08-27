import { cn } from "@/lib/utils";
import { IconBadge, type IconBadgeTone } from "./IconBadge";

export interface StatCardTrend {
  /** Signed percentage or absolute delta, e.g. +12.5 */
  value: number;
  /** When true, a downward movement is "good" (renders green). */
  invert?: boolean;
  /** Optional context label, e.g. "vs last week". */
  label?: string;
}

/** Small pastel status pill rendered under the value. */
export interface StatCardPill {
  label: string;
  tone?: "success" | "danger" | "warn" | "info" | "neutral";
}

export interface StatCardProps {
  /** Small gray caption above the number. */
  label: string;
  /** The big bold value (already formatted). */
  value: React.ReactNode;
  /** Filled dark background treatment for emphasis. */
  highlight?: boolean;
  /** Optional trend indicator (rendered as a colored delta chip). */
  trend?: StatCardTrend;
  /** Optional icon shown top-right inside a pastel circular badge. */
  icon?: React.ReactNode;
  /** Pastel tone for the icon badge. */
  tone?: IconBadgeTone;
  /** Muted secondary line directly under the label, e.g. "No Active Package". */
  secondary?: React.ReactNode;
  /** Optional secondary caption under the value. */
  sublabel?: string;
  /** Optional pastel status pill under the value. */
  pill?: StatCardPill;
  /** Optional mini sparkline series. */
  spark?: number[];
  className?: string;
}

/** Renders a compact sparkline polyline for the KPI tile. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const w = 72;
  const h = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const pillTones: Record<NonNullable<StatCardPill["tone"]>, string> = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-muted text-ink-muted",
};

/**
 * Metric card: label + muted secondary line + big value on the left, pastel
 * circular icon badge on the right, optional helper text / status pill below.
 */
export function StatCard({
  label,
  value,
  highlight = false,
  trend,
  icon,
  tone = "blue",
  secondary,
  sublabel,
  pill,
  spark,
  className,
}: StatCardProps) {
  const trendUp = trend ? trend.value >= 0 : false;
  const trendGood = trend ? (trend.invert ? !trendUp : trendUp) : false;
  const sparkColor = highlight
    ? "rgba(255,255,255,0.9)"
    : trend
      ? trendGood
        ? "var(--success)"
        : "var(--danger)"
      : "var(--accent)";

  return (
    <div
      className={cn(
        "rounded-card p-6 shadow-sm transition-shadow hover:shadow-card-hover",
        highlight
          ? "bg-darkcard text-darkcard-ink"
          : "border border-line-soft bg-surface text-ink",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm",
              highlight ? "text-white/80" : "text-ink-muted",
            )}
          >
            {label}
          </p>
          {secondary && (
            <p
              className={cn(
                "mt-0.5 text-sm",
                highlight ? "text-white/60" : "text-ink-subtle",
              )}
            >
              {secondary}
            </p>
          )}
        </div>

        {icon &&
          (highlight ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              {icon}
            </span>
          ) : (
            <IconBadge tone={tone}>{icon}</IconBadge>
          ))}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-3xl font-bold leading-none tracking-tight">
          {value}
        </span>
        {spark && spark.length > 0 && <Sparkline data={spark} color={sparkColor} />}
      </div>

      {(trend || sublabel || pill) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-bold",
                highlight ? "text-white" : trendGood ? "text-success" : "text-danger",
              )}
            >
              {trendUp ? "+" : "−"}
              {Math.abs(trend.value)}%
            </span>
          )}
          {(sublabel || trend?.label) && (
            <span
              className={cn(
                "text-xs",
                highlight ? "text-white/70" : "text-ink-subtle",
              )}
            >
              {sublabel ?? trend?.label}
            </span>
          )}
          {pill && (
            <span
              className={cn(
                "inline-block rounded-md px-2 py-1 text-xs font-medium",
                highlight
                  ? "bg-white/15 text-white"
                  : pillTones[pill.tone ?? "neutral"],
              )}
            >
              {pill.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
