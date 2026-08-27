import { cn, initials } from "@/lib/utils";

export interface AvatarProps {
  /** Full name used for initials + alt text. May be null (falls back to "U"). */
  name?: string | null;
  /** Optional image URL. Falls back to initials when absent. */
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  /** Small status dot color, e.g. for online presence. */
  status?: "success" | "warn" | "danger" | "neutral" | null;
  className?: string;
}

const sizeMap = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const dotSize = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

const statusColor = {
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  neutral: "bg-ink-subtle",
};

/** Circular avatar showing an image or derived initials, with optional status dot. */
export function Avatar({ name, src, size = "md", status, className }: AvatarProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name ?? undefined}
          className={cn("rounded-full object-cover", sizeMap[size])}
        />
      ) : (
        <span
          aria-label={name ?? undefined}
          className={cn(
            "flex items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink",
            sizeMap[size],
          )}
        >
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-surface",
            dotSize[size],
            statusColor[status],
          )}
        />
      )}
    </span>
  );
}
