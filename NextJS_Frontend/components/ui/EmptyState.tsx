import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Icon element. Defaults to an inbox. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional call-to-action (e.g. a Button). */
  action?: React.ReactNode;
  /** Compact variant for inside cards/tables. */
  compact?: boolean;
  className?: string;
}

/** Friendly empty placeholder for lists, tables, and pages. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-16",
        className,
      )}
    >
      {/* Large, low-contrast outline glyph — no filled circle behind it. */}
      <div className="text-line">{icon ?? <Inbox size={48} strokeWidth={1.5} />}</div>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
