import { cn } from "@/lib/utils";

export type CountBadgeTone = "blue" | "green" | "amber" | "rose" | "indigo" | "slate";

export interface CountBadgeProps {
  /** Numeric/short value shown inside the circle. */
  children: React.ReactNode;
  tone?: CountBadgeTone;
  className?: string;
}

/**
 * Small solid circular badge for numeric cells in tables
 * (recipients, delivered counts, …). White text on a saturated fill.
 */
const tones: Record<CountBadgeTone, string> = {
  blue: "bg-[var(--tone-blue)]",
  green: "bg-[var(--success)]",
  amber: "bg-[var(--warn)]",
  rose: "bg-[var(--danger)]",
  indigo: "bg-[var(--tone-indigo)]",
  slate: "bg-[var(--tone-slate)]",
};

export function CountBadge({ children, tone = "blue", className }: CountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums text-white",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
