import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warn"
  | "danger"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Small leading dot. */
  dot?: boolean;
  /** Saturated fill with white text (e.g. a "100%" status pill in a table). */
  solid?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

const solidVariants: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--tone-slate)] text-white",
  accent: "bg-accent text-white",
  success: "bg-success text-white",
  warn: "bg-warn text-white",
  danger: "bg-danger text-white",
  info: "bg-info text-white",
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: "bg-ink-subtle",
  accent: "bg-accent",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  info: "bg-info",
};

/** Small label chip for tags, counts, and inline status. */
export function Badge({
  variant = "neutral",
  dot,
  solid = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill text-xs",
        solid ? "px-2.5 py-1 font-semibold" : "px-2.5 py-0.5 font-medium",
        solid ? solidVariants[variant] : variants[variant],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            solid ? "bg-white/80" : dotColors[variant],
          )}
        />
      )}
      {children}
    </span>
  );
}
