"use client";

import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Optional inline label rendered to the right of the switch. */
  label?: React.ReactNode;
  id?: string;
  size?: "sm" | "md";
  className?: string;
}

/** Accessible on/off switch (aka Switch) using the mint accent when on. */
export function Toggle({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
  size = "md",
  className,
}: ToggleProps) {
  const dims =
    size === "sm"
      ? { track: "h-5 w-9", knob: "h-4 w-4", travel: "translate-x-4" }
      : { track: "h-6 w-11", knob: "h-5 w-5", travel: "translate-x-5" };

  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2.5",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1",
          dims.track,
          checked ? "bg-accent" : "bg-ink-subtle/50",
        )}
      >
        <span
          className={cn(
            "inline-block transform rounded-full bg-white shadow transition-transform",
            dims.knob,
            "translate-x-0.5",
            checked && dims.travel,
          )}
        />
      </button>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}

/** Alias so consumers can import either name. */
export const Switch = Toggle;
