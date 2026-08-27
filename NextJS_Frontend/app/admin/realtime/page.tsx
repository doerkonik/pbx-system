"use client";

/**
 * Admin › Realtime — FOP2-style live wallboard. Initial snapshot via REST, then
 * live updates pushed over the WebSocket. Admins see every agent/queue/call.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useTelephonyEvents } from "@/lib/ws";
import {
  PageHeader,
  Card,
  StatCard,
  ProgressRing,
  RosterRow,
  StatusListRow,
  Spinner,
  EmptyState,
  StatusPill,
  type StatusPillVariant,
} from "@/components/ui";

interface AgentTile {
  extension: string;
  presence: StatusPillVariant;
  reason?: string;
  channel?: string;
}
interface QueueTile {
  queue: string;
  calls: number;
  longestWait: number;
  membersAvailable: number;
  membersTotal: number;
}
interface CallTile {
  uniqueid: string;
  channel: string;
  extension: string;
  state: string;
  callerNum?: string;
  callerName?: string;
}
interface Summary {
  activeCalls: number;
  agentsOnline: number;
  callsInQueue: number;
  longestWait: number;
  slaPct?: number;
}

const PRESENCES: StatusPillVariant[] = [
  "idle", "ringing", "in_call", "on_hold", "paused", "offline",
];
const asPresence = (p?: string): StatusPillVariant =>
  PRESENCES.includes(p as StatusPillVariant) ? (p as StatusPillVariant) : "offline";

export default function RealtimePage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [agents, setAgents] = useState<AgentTile[]>([]);
  const [queues, setQueues] = useState<QueueTile[]>([]);
  const [calls, setCalls] = useState<CallTile[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, q, c, s] = await Promise.allSettled([
      api.get<any[]>("/dashboard/agents"),
      api.get<any[]>("/dashboard/queues"),
      api.get<any[]>("/dashboard/calls"),
      api.get<Summary>("/dashboard/summary"),
    ]);
    if (a.status === "fulfilled")
      setAgents((a.value ?? []).map((x) => ({ ...x, presence: asPresence(x.presence) })));
    if (q.status === "fulfilled") setQueues(q.value ?? []);
    if (c.status === "fulfilled") setCalls(c.value ?? []);
    if (s.status === "fulfilled") setSummary(s.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Apply live events to the in-memory tiles.
  const { connectionState } = useTelephonyEvents({
    onEvent: (ev) => {
      const e = ev as any;
      if (e.extension && (e.presence || e.event?.startsWith("endpoint"))) {
        setAgents((prev) => {
          const idx = prev.findIndex((x) => x.extension === e.extension);
          const tile: AgentTile = {
            extension: e.extension,
            presence: asPresence(e.presence),
            reason: e.reason,
            channel: e.channel,
          };
          if (idx === -1) return [...prev, tile];
          const next = [...prev];
          next[idx] = { ...next[idx], ...tile };
          return next;
        });
      }
      if (e.event === "queue.snapshot" && e.queue && e.raw) {
        setQueues((prev) => {
          const idx = prev.findIndex((x) => x.queue === e.queue);
          const tile: QueueTile = {
            queue: e.queue,
            calls: Number(e.raw.calls ?? 0),
            longestWait: Number(e.raw.longestWait ?? 0),
            membersAvailable: Number(e.raw.membersAvailable ?? 0),
            membersTotal: Number(e.raw.membersTotal ?? 0),
          };
          if (idx === -1) return [...prev, tile];
          const next = [...prev];
          next[idx] = tile;
          return next;
        });
      }
      if (typeof e.event === "string" && e.event.startsWith("call.")) {
        void load();
      }
    },
  });

  const sla = summary?.slaPct ?? 0;
  const callsInQueue = useMemo(
    () => queues.reduce((sum, q) => sum + q.calls, 0),
    [queues],
  );
  const longestWait = useMemo(
    () => queues.reduce((m, q) => Math.max(m, q.longestWait), 0),
    [queues],
  );

  if (authLoading || !user) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Realtime dashboard"
        description="Live agent, queue, and call activity."
        actions={
          <StatusPill
            variant={connectionState === "connected" ? "idle" : "offline"}
            label={connectionState === "connected" ? "Live" : connectionState}
            dot
            pulse={connectionState === "connected"}
          />
        }
      />

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Active calls" value={summary?.activeCalls ?? calls.length} highlight icon={connectionState === "connected" ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />} />
        <StatCard label="Agents online" value={summary?.agentsOnline ?? agents.filter((a) => a.presence !== "offline").length} />
        <StatCard label="Calls in queue" value={summary?.callsInQueue ?? callsInQueue} />
        <StatCard label="Longest wait" value={`${summary?.longestWait ?? longestWait}s`} />
        <Card className="flex items-center justify-center p-3"><ProgressRing value={sla} size={72} caption="SLA" /></Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agent roster */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold text-ink">Agents</h3>
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : agents.length === 0 ? (
            <EmptyState title="No agents" description="Registered agents appear here." />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {agents.map((a) => (
                <RosterRow
                  key={a.extension}
                  name={a.extension}
                  stat={a.reason || a.channel || ""}
                  status={a.presence}
                  statusLabel={a.presence === "paused" && a.reason ? a.reason : undefined}
                  pulse={a.presence === "ringing" || a.presence === "in_call"}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Queues */}
        <Card className="p-5">
          <h3 className="mb-4 text-base font-semibold text-ink">Queues</h3>
          {queues.length === 0 ? (
            <EmptyState title="No queues" description="Live queue stats appear here." />
          ) : (
            <div className="divide-y divide-line">
              {queues.map((q) => (
                <StatusListRow
                  key={q.queue}
                  name={q.queue}
                  subtitle={`${q.membersAvailable}/${q.membersTotal} available`}
                  status={q.calls > 0 ? "ringing" : "idle"}
                  metric={`${q.calls} waiting · ${q.longestWait}s`}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Active calls */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 text-base font-semibold text-ink">Active calls</h3>
        {calls.length === 0 ? (
          <EmptyState title="No active calls" description="Live calls appear here." />
        ) : (
          <div className="divide-y divide-line">
            {calls.map((c) => (
              <StatusListRow
                key={c.uniqueid}
                name={c.callerName || c.callerNum || c.channel}
                subtitle={`Extension ${c.extension}`}
                status={c.state === "call.hold" ? "on_hold" : c.state === "call.answered" ? "in_call" : "ringing"}
                metric={c.state.replace("call.", "")}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
