"use client";

/** Top-bar notifications bell: unread count, dropdown list, live via socket. */
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useTelephonyEvents } from "@/lib/ws";
import { cn } from "@/lib/utils";

interface Notif {
  id: string; type: string; title: string; body?: string | null;
  link?: string | null; readAt?: string | null; createdAt: string;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([
        api.get<Notif[]>("/notifications"),
        api.get<{ count: number }>("/notifications/unread-count"),
      ]);
      setItems(n); setUnread(c.count);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Live pushes over the socket (notification.events → user room).
  useTelephonyEvents({
    onNotification: (event, payload) => {
      if (event !== "notification") return;
      setItems((p) => [payload as unknown as Notif, ...p].slice(0, 50));
      setUnread((u) => u + 1);
    },
  });

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function markAll() {
    try {
      await api.post("/notifications/read-all");
      setUnread(0);
      setItems((p) => p.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch { /* ignore */ }
  }
  async function markOne(n: Notif) {
    if (n.readAt) return;
    try {
      await api.post(`/notifications/${n.id}/read`);
      setUnread((u) => Math.max(0, u - 1));
      setItems((p) => p.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => { setOpen((o) => !o); if (!open) void load(); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-muted"
      >
        <Bell size={20} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-subtle">No notifications.</p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markOne(n)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 border-b border-line/60 px-3 py-2.5 text-left transition-colors hover:bg-surface-muted",
                  !n.readAt && "bg-accent-soft/40",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </span>
                {n.body && <span className="text-xs text-ink-muted">{n.body}</span>}
                <span className="text-[10px] text-ink-subtle">{new Date(n.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
