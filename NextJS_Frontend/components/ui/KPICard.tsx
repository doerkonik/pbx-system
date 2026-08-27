import { cn } from "@/lib/utils";

export type KpiTone = "amber" | "green" | "blue" | "rose" | "violet" | "neutral";

export interface KPICardProps {
  /** Small caption above the number. */
  label: string;
  /** Big bold value (already formatted). */
  value: React.ReactNode;
  /** Line icon shown inside a colored circle on the left. */
  icon?: React.ReactNode;
  tone?: KpiTone;
  className?: string;
}

const toneMap: Record<KpiTone, string> = {
  amber: "bg-accent-soft text-accent-ink",
  green: "bg-success-soft text-success",
  blue: "bg-info-soft text-info",
  rose: "bg-danger-soft text-danger",
  violet: "bg-[color:var(--chart-5)]/15 text-[color:var(--chart-5)]",
  neutral: "bg-surface-muted text-ink-muted",
};

/** KPI summary card: icon-in-circle (left) + big number + small label. */
export function KPICard({ label, value, icon, tone = "amber", className }: KPICardProps) {
  return (
    <div className={cn("flex items-center gap-4 rounded-card border border-line-soft bg-surface p-6 shadow-sm", className)}>
      {icon && (
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", toneMap[tone])}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
      </div>
    </div>
  );
}
