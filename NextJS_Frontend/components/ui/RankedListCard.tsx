import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

export interface RankedItem {
  name: string;
  metric?: React.ReactNode;
  sub?: string;
  avatar?: string | null;
}

export interface RankedListCardProps {
  title: React.ReactNode;
  items: RankedItem[];
  className?: string;
}

/** Ranked list card: numbered rows of avatar + name + metric. */
export function RankedListCard({ title, items, className }: RankedListCardProps) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-5 shadow-card", className)}>
      <h3 className="mb-3 text-base font-semibold text-ink">{title}</h3>
      <ol className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5">
            <span className="w-4 shrink-0 text-center text-sm font-bold text-accent-ink">{i + 1}</span>
            <Avatar name={it.name} src={it.avatar ?? undefined} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{it.name}</p>
              {it.sub && <p className="truncate text-xs text-ink-subtle">{it.sub}</p>}
            </div>
            {it.metric != null && <span className="shrink-0 text-sm font-semibold text-ink">{it.metric}</span>}
          </li>
        ))}
        {items.length === 0 && <li className="py-3 text-center text-sm text-ink-subtle">No data.</li>}
      </ol>
    </div>
  );
}
