"use client";

/**
 * Toast system: a provider (mount once, e.g. in the root layout), a
 * `useToast()` hook to fire toasts, and a self-rendering viewport.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warn" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Set 0 to disable. Defaults to 4000. */
  duration?: number;
}

interface ToastRecord extends Required<Omit<ToastOptions, "description">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-success" />,
  error: <XCircle size={18} className="text-danger" />,
  warn: <AlertTriangle size={18} className="text-warn" />,
  info: <Info size={18} className="text-info" />,
};

const accentBar: Record<ToastVariant, string> = {
  success: "bg-success",
  error: "bg-danger",
  warn: "bg-warn",
  info: "bg-info",
};

/** Wrap the app once. Renders the toast viewport and provides `useToast`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions): string => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const record: ToastRecord = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? "info",
      duration: opts.duration ?? 4000,
    };
    setToasts((prev) => [...prev, record]);
    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** Alias matching the "Toaster" naming convention. */
export const Toaster = ToastProvider;

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  // Render nothing until after mount. A `typeof document` check here would be
  // false on the server but true on the very first client render, so the
  // viewport <div> would be absent from the server HTML yet present in the
  // initial client tree — a hydration mismatch that forces React to discard
  // the server-rendered root (which also wipes the pre-paint theme class).
  // Gating on mounted state keeps both first renders identical (null), and
  // costs nothing visually since the viewport is empty until a toast fires.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-card border border-line bg-surface p-3 pl-4 shadow-pop animate-toast-in">
      <span
        className={cn(
          "absolute bottom-0 left-0 top-0 w-1",
          accentBar[toast.variant],
        )}
      />
      <span className="mt-0.5 shrink-0">{icons[toast.variant]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-sm text-ink-muted">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 -mt-1 shrink-0 rounded p-1 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Fire toasts from anywhere under the provider. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
