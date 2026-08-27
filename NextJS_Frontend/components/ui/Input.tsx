import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the field. */
  label?: string;
  /** Helper or error text rendered below the field. */
  hint?: string;
  /** Marks the field invalid and shows `hint` in the danger color. */
  error?: boolean | string;
  /** Icon rendered inside the field, leading edge. */
  leftIcon?: React.ReactNode;
  /** Content rendered inside the field, trailing edge. */
  rightSlot?: React.ReactNode;
  containerClassName?: string;
}

/** Text input with label, hint, error state, and optional icon slots. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftIcon,
    rightSlot,
    className,
    containerClassName,
    id,
    ...props
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const isError = Boolean(error);
  const message = typeof error === "string" ? error : hint;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={isError || undefined}
          className={cn(
            "h-11 w-full rounded-lg border bg-surface px-3.5 text-sm text-ink shadow-xs outline-none transition-all",
            "placeholder:text-ink-subtle",
            "focus:border-accent focus:ring-4 focus:ring-accent/10",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
            leftIcon && "pl-10",
            rightSlot && "pr-10",
            isError
              ? "border-danger focus:border-danger focus:ring-danger/10"
              : "border-line",
            className,
          )}
          {...props}
        />
        {rightSlot && (
          <span className="absolute inset-y-0 right-2 flex items-center">
            {rightSlot}
          </span>
        )}
      </div>
      {message && (
        <p
          className={cn(
            "mt-1.5 text-xs",
            isError ? "text-danger" : "text-ink-muted",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});
