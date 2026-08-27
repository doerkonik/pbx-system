import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** Pixel size of the spinner. Defaults to 20. */
  size?: number;
  className?: string;
  /** Accessible label (visually hidden). */
  label?: string;
}

/** A minimal accessible loading spinner. */
export function Spinner({ size = 20, className, label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex">
      <Loader2
        size={size}
        className={cn("animate-[spin_0.7s_linear_infinite] text-ink-muted", className)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
