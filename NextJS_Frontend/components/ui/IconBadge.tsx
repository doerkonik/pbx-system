import { cn } from "@/lib/utils";

/** Pastel tone pairs used for card icon badges. */
export type IconBadgeTone =
  | "blue"
  | "indigo"
  | "purple"
  | "amber"
  | "rose"
  | "green"
  | "slate";

export interface IconBadgeProps {
  /** Icon element, rendered at ~20–24px. */
  children: React.ReactNode;
  tone?: IconBadgeTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Circular pastel icon badge shown at the top-right of stat cards.
 * Pastel fill, matching colored glyph, no border.
 */
const tones: Record<IconBadgeTone, string> = {
  blue: "bg-tone-blue-bg text-tone-blue",
  indigo: "bg-tone-indigo-bg text-tone-indigo",
  purple: "bg-tone-purple-bg text-tone-purple",
  amber: "bg-tone-amber-bg text-tone-amber",
  rose: "bg-tone-rose-bg text-tone-rose",
  green: "bg-tone-green-bg text-tone-green",
  slate: "bg-tone-slate-bg text-tone-slate",
};

const sizes = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-14 w-14",
};

export function IconBadge({
  children,
  tone = "blue",
  size = "md",
  className,
}: IconBadgeProps) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
