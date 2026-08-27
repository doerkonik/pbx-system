import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  hint?: string;
  error?: boolean | string;
  /** Options to render. Alternatively pass children. */
  options?: SelectOption[];
  /** Placeholder rendered as a disabled first option. */
  placeholder?: string;
  children?: React.ReactNode;
  containerClassName?: string;
}

/** Native select styled to match the design system. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    hint,
    error,
    options,
    placeholder,
    className,
    containerClassName,
    id,
    children,
    value,
    defaultValue,
    ...props
  },
  ref,
) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const isError = Boolean(error);
  const message = typeof error === "string" ? error : hint;

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={isError || undefined}
          value={value}
          defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border bg-surface pl-3 pr-9 text-sm text-ink shadow-xs outline-none transition-colors",
            "focus:border-accent focus:ring-4 focus:ring-accent/10",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
            isError
              ? "border-danger focus:border-danger focus:ring-danger/10"
              : "border-line",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute inset-y-0 right-3 my-auto text-ink-subtle"
        />
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
