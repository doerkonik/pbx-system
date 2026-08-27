import { cn } from "@/lib/utils";

export type BarTone = "amber" | "green" | "blue" | "rose" | "violet" | "neutral";

export interface ProgressBarProps {
  label?: React.ReactNode;
  /** 0–100. */
  value: number;
  tone?: BarTone;
  showValue?: boolean;
  className?: string;
}

const fill: Record<BarTone, string> = {
  amber: "bg-accent",
  green: "bg-success",
  blue: "bg-info",
  rose: "bg-danger",
  violet: "bg-[color:var(--chart-5)]",
  neutral: "bg-ink",
};

/** Labeled horizontal progress bar (used in "working format" style rows). */
export function ProgressBar({ label, value, tone = "amber", showValue = true, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          {label ? <span className="text-ink-muted">{label}</span> : <span />}
          {showValue && <span className="font-semibold text-ink">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={cn("h-full rounded-full transition-[width]", fill[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
