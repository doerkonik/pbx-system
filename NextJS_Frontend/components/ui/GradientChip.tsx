import { cn } from "@/lib/utils";

export interface GradientChipProps {
  /** Small caption above the value, e.g. "Balance". */
  label: React.ReactNode;
  /** Bold headline value. */
  value: React.ReactNode;
  /** Optional leading icon. */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Indigo→purple gradient summary pill used top-right of a page header
 * (balance, credit, quota). White text on the gradient, subtle elevation.
 */
export function GradientChip({ label, value, icon, className }: GradientChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 rounded-card bg-gradient-to-r from-grad-from to-grad-to px-4 py-2.5 text-white shadow-sm",
        className,
      )}
    >
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          {icon}
        </span>
      )}
      <span className="leading-tight">
        <span className="block text-xs font-medium text-white/80">{label}</span>
        <span className="block text-lg font-bold tabular-nums">{value}</span>
      </span>
    </div>
  );
}
