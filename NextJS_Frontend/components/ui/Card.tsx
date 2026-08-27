import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds a subtle hover elevation. */
  interactive?: boolean;
  /** Removes inner padding (for tables / edge-to-edge content). */
  flush?: boolean;
}

/** White surface card: 12px radius, hairline border, subtle shadow, 24px padding. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive, flush, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-card border border-line-soft bg-surface shadow-sm",
        !flush && "p-6",
        interactive && "transition-shadow hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  );
});

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned actions (buttons, menus). */
  actions?: React.ReactNode;
  /**
   * Section-title row treatment for `flush` cards (tables/lists): supplies its
   * own px-6 py-4 padding and a bottom hairline instead of a bottom margin.
   */
  bordered?: boolean;
}

/** Header row for a Card: title/subtitle on the left, actions on the right. */
export function CardHeader({
  title,
  subtitle,
  actions,
  bordered = false,
  className,
  children,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        bordered
          ? "border-b border-line-soft px-6 py-4"
          : (title || subtitle) && "mb-4",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {title && <h3 className="text-base font-bold text-ink">{title}</h3>}
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface KpiRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of columns at desktop width. Defaults to auto-fit. */
  columns?: 2 | 3 | 4 | 5;
}

const columnClasses: Record<NonNullable<KpiRowProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

/** Responsive grid for laying out a row of StatCards / KPI tiles. */
export function KpiRow({ columns = 4, className, ...props }: KpiRowProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-6", columnClasses[columns], className)}
      {...props}
    />
  );
}
