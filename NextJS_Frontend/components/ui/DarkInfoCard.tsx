import { cn } from "@/lib/utils";

export interface DarkInfoCardProps {
  title: React.ReactNode;
  /** Right-aligned header control (e.g. a "View all" link or menu). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** Near-black contrast card for the most important live/urgent panel. */
export function DarkInfoCard({ title, action, children, className }: DarkInfoCardProps) {
  return (
    <div className={cn("rounded-card bg-darkcard p-5 text-darkcard-ink shadow-pop", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export type DarkDot = "amber" | "green" | "blue" | "rose";

export interface DarkInfoItemProps {
  title: React.ReactNode;
  time?: React.ReactNode;
  dot?: DarkDot;
  /** Right-aligned slot (e.g. an avatar group or badge). */
  right?: React.ReactNode;
}

const dotColor: Record<DarkDot, string> = {
  amber: "bg-accent",
  green: "bg-success",
  blue: "bg-info",
  rose: "bg-danger",
};

/** A row inside a DarkInfoCard: bullet dot + title + time (+ optional right slot). */
export function DarkInfoItem({ title, time, dot = "amber", right }: DarkInfoItemProps) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2.5 last:mb-0">
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", dotColor[dot])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {time && <p className="truncate text-xs text-darkcard-muted">{time}</p>}
      </div>
      {right}
    </div>
  );
}
