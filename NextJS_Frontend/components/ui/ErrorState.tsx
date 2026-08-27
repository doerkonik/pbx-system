import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Underlying error to derive a message from when description is absent. */
  error?: unknown;
  /** Retry handler — renders a "Try again" button when provided. */
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

function messageOf(error: unknown): string | undefined {
  if (!error) return undefined;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return undefined;
}

/** Error placeholder with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  const desc = description ?? messageOf(error) ?? "Please try again in a moment.";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8" : "py-16",
        className,
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle size={22} />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{desc}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
