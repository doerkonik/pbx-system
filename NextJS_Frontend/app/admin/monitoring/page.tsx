"use client";
/** Admin/Supervisor › Live Wallboard — real-time KPIs, queues, agents, SLA alerts. */
import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneCall, Users, Clock, AlertTriangle, Hourglass, Radio } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useTelephonyEvents } from "@/lib/ws";
import { formatDuration } from "@/lib/utils";
import {
  PageHeader, Card, StatusPill, Badge, Spinner, useToast,
  KPICard, DarkInfoCard, DarkInfoItem, type StatusPillVariant,
} from "@/components/ui";

interface Wallboard {
  generatedAt: string;
  kpis: { activeCalls: number; agentsOnline: number; callsWaiting: number; longestWait: number; openAlerts: number };
  queues: { queue: string; calls: number; longestWait: number; membersAvailable: number; membersTotal: number; abandoned: number; completed: number; breaches: string[]; atRisk: boolean }[];
  agents: { extension: string; presence: string; reason: string }[];
}
interface Alert { id: string; queueName: string; type: string; severity: string; message: string; createdAt: string; resolvedAt: string | null; }

const presenceVariant = (p: string): StatusPillVariant =>
  (["idle", "ringing", "in_call", "on_hold", "paused", "acw", "dnd", "offline"] as const).includes(p as any)
    ? (p as StatusPillVariant) : "neutral";

export default function MonitoringPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [wb, setWb] = useState<Wallboard | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [w, a] = await Promise.allSettled([
      api.get<Wallboard>("/monitoring/wallboard"),
      api.get<Alert[]>("/monitoring/alerts", { params: { openOnly: "true" } }),
    ]);
    if (w.status === "fulfilled") setWb(w.value);
    if (a.status === "fulfilled") setAlerts(a.value);
    setLoading(false);
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [user, load]);

  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { connectionState } = useTelephonyEvents({
    onMonitoring: (p) => {
      if (p.kind !== "sla") return;
      if (p.event === "alert") {
        toastRef.current({ variant: "error", title: "SLA alert", description: String(p.message ?? "") });
        void load();
      } else if (p.event === "resolved") {
        void load();
      }
    },
  });

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  const k = wb?.kpis;

  return (
    <div>
      <PageHeader title="Live Wallboard" description="Real-time queue, agent and SLA status."
        actions={
          <StatusPill variant={connectionState === "connected" ? "idle" : "offline"}
            label={connectionState === "connected" ? "Live" : connectionState}
            dot pulse={connectionState === "connected"} />
        } />

      {loading && !wb ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            <KPICard label="Active calls" value={k?.activeCalls ?? 0} tone="amber" icon={<PhoneCall className="h-5 w-5" />} />
            <KPICard label="Agents online" value={k?.agentsOnline ?? 0} tone="green" icon={<Users className="h-5 w-5" />} />
            <KPICard label="Callers waiting" value={k?.callsWaiting ?? 0} tone="blue" icon={<Hourglass className="h-5 w-5" />} />
            <KPICard label="Longest wait" value={formatDuration(k?.longestWait ?? 0)} tone="neutral" icon={<Clock className="h-5 w-5" />} />
            <KPICard label="Open alerts" value={k?.openAlerts ?? 0} tone="rose" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Queues */}
            <Card className="lg:col-span-2">
              <h3 className="mb-4 text-base font-semibold text-ink">Queues</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-sm font-bold text-ink-muted">
                      <th className="py-2 pr-3 font-medium">Queue</th>
                      <th className="py-2 pr-3 font-medium">Waiting</th>
                      <th className="py-2 pr-3 font-medium">Longest</th>
                      <th className="py-2 pr-3 font-medium">Avail/Total</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(wb?.queues ?? []).map((q) => (
                      <tr key={q.queue} className="border-b border-line/60">
                        <td className="py-2 pr-3 font-medium text-ink">{q.queue}</td>
                        <td className="py-2 pr-3 tabular-nums">{q.calls}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatDuration(q.longestWait)}</td>
                        <td className="py-2 pr-3 tabular-nums">{q.membersAvailable}/{q.membersTotal}</td>
                        <td className="py-2 pr-3">
                          {q.atRisk
                            ? <Badge variant="danger">{q.breaches.join(", ")}</Badge>
                            : <Badge variant="success">OK</Badge>}
                        </td>
                      </tr>
                    ))}
                    {(!wb?.queues || wb.queues.length === 0) && (
                      <tr><td colSpan={5} className="py-6 text-center text-ink-subtle">No live queue data.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Live SLA alerts — dark contrast panel */}
            <DarkInfoCard
              title="SLA alerts"
              action={<span className="text-xs text-darkcard-muted">{alerts.length} open</span>}
            >
              {alerts.length === 0 && <p className="text-sm text-darkcard-muted">No open alerts. 🎉</p>}
              {alerts.map((a) => (
                <DarkInfoItem
                  key={a.id}
                  dot={a.severity === "critical" ? "rose" : "amber"}
                  title={a.queueName}
                  time={a.message}
                  right={<Badge variant={a.severity === "critical" ? "danger" : "warn"}>{a.severity}</Badge>}
                />
              ))}
            </DarkInfoCard>
          </div>

          {/* Agents */}
          <Card>
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
              <Radio className="h-4 w-4 text-ink-subtle" /> Agents
            </h3>
            <div className="flex flex-wrap gap-2">
              {(wb?.agents ?? []).map((a) => (
                <div key={a.extension} className="flex items-center gap-2 rounded-xl border border-line bg-surface-muted/50 px-3 py-1.5">
                  <span className="text-sm font-medium text-ink">{a.extension}</span>
                  <StatusPill variant={presenceVariant(a.presence)} dot />
                </div>
              ))}
              {(!wb?.agents || wb.agents.length === 0) && (
                <p className="text-sm text-ink-subtle">No agents online.</p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
