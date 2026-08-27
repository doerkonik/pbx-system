"use client";

import { cn } from "@/lib/utils";

export interface TabItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  /** Optional small count badge. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Visual style: underline (default) or pill segmented control. */
  variant?: "underline" | "pill";
  size?: "sm" | "md";
  className?: string;
}

/** Controlled tab switcher. Underline or segmented-pill styles. */
export function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  variant = "underline",
  size = "md",
  className,
}: TabsProps<T>) {
  if (variant === "pill") {
    return (
      <div
        role="tablist"
        className={cn(
          "inline-flex items-center gap-1 rounded-lg bg-surface-muted p-1",
          className,
        )}
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              disabled={tab.disabled}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50",
                size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="text-ink-subtle">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={cn("flex items-center gap-4 border-b border-line", className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.value)}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 font-medium transition-colors disabled:opacity-50",
              size === "sm" ? "text-xs" : "text-sm",
              active
                ? "border-accent text-ink"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span
                className={cn(
                  "rounded-pill px-1.5 py-0.5 text-[10px] font-semibold",
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "bg-surface-muted text-ink-subtle",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
