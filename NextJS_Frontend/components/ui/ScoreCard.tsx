import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScoreCardProps {
  /** Small header title (top-left). */
  title?: React.ReactNode;
  /** The big bold figure (percentage or number). */
  value: React.ReactNode;
  /** Colored change indicator; positive renders green/up, negative red/down. */
  change?: { value: number; label?: string; invert?: boolean };
  /** Right-aligned control (e.g. a "Past 3 months" dropdown/filter). */
  filter?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** Large stat/score card with a change indicator and optional filter control. */
export function ScoreCard({ title, value, change, filter, children, className }: ScoreCardProps) {
  const up = change ? change.value >= 0 : false;
  const good = change ? (change.invert ? !up : up) : false;
  return (
    <div className={cn("rounded-card border border-line bg-surface p-6 shadow-card", className)}>
      <div className="flex items-start justify-between gap-3">
        {title && <h3 className="text-sm font-medium text-ink-muted">{title}</h3>}
        {filter}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <span className="text-4xl font-bold leading-none tracking-tight text-ink">{value}</span>
        {change && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-pill px-2 py-0.5 text-xs font-semibold",
            good ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
          )}>
            {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change.value)}%
            {change.label && <span className="ml-1 font-normal text-ink-subtle">{change.label}</span>}
          </span>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
