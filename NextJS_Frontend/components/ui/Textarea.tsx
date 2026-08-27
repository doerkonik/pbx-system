import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: boolean | string;
  containerClassName?: string;
}

/** Multi-line text field matching the Input styling. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { label, hint, error, className, containerClassName, id, rows = 4, ...props },
    ref,
  ) {
    const reactId = useId();
    const areaId = id ?? reactId;
    const isError = Boolean(error);
    const message = typeof error === "string" ? error : hint;

    return (
      <div className={cn("w-full", containerClassName)}>
        {label && (
          <label
            htmlFor={areaId}
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          aria-invalid={isError || undefined}
          className={cn(
            "w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-ink shadow-xs outline-none transition-colors",
            "placeholder:text-ink-subtle",
            "focus:border-accent focus:ring-4 focus:ring-accent/10",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
            isError
              ? "border-danger focus:border-danger focus:ring-danger/10"
              : "border-line",
            className,
          )}
          {...props}
        />
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
  },
);
