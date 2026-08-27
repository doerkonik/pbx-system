"use client";
/** Admin › Overview — KPIs, live telephony and analytics. */
import { useCallback, useEffect, useState } from "react";
import { Activity, Users, PhoneCall, Clock } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useTelephonyEvents } from "@/lib/ws";
import {
  PageHeader,
  Card,
  Spinner,
  StatusPill,
  KPICard,
  ScoreCard,
  DarkInfoCard,
  DarkInfoItem,
  ProgressBar,
} from "@/components/ui";

interface Summary {
  activeCalls: number;
  agentsOnline: number;
  callsInQueue: number;
  longestWait: number;
  slaPct?: number;
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export default function AdminOverview() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hours, setHours] = useState<{ hour: string; count: number }[]>([]);
  const [outcome, setOutcome] = useState({ answered: 0, missed: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, peak, rep] = await Promise.allSettled([
      api.get<Summary>("/dashboard/summary"),
      api.get<any>("/analytics/peak-hours", {
        params: { from: todayISO(0), to: todayISO(0) },
      }),
      api.get<any>("/reports/summary", {
        params: { from: todayISO(29), to: todayISO(0) },
      }),
    ]);
    if (s.status === "fulfilled") setSummary(s.value);

    const base = Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}`,
      count: 0,
    }));
    if (peak.status === "fulfilled") {
      const rows: any[] = Array.isArray(peak.value) ? peak.value : peak.value?.data ?? [];
      for (const r of rows) {
        const h = Number(r.hour ?? r.h);
        if (h >= 0 && h < 24) base[h].count = Number(r.count ?? r.calls ?? 0);
      }
    }
    setHours(base);

    if (rep.status === "fulfilled") {
      const v = rep.value ?? {};
      const total = Number(v.totalCalls ?? 0);
      const answered = Number(v.answered ?? 0);
      setOutcome({ answered, missed: Math.max(0, total - answered) });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const { connectionState } = useTelephonyEvents({ onEvent: () => void 0 });
  useEffect(() => {
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const outcomeTotal = outcome.answered + outcome.missed;
  const answerRate = outcomeTotal ? Math.round((outcome.answered / outcomeTotal) * 100) : 0;

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description="System status and activity at a glance."
        actions={
          <StatusPill
            variant={connectionState === "connected" ? "idle" : "offline"}
            label={connectionState === "connected" ? "Telephony live" : connectionState}
            dot
            pulse={connectionState === "connected"}
          />
        }
      />

      {/* KPI summary row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Active calls" value={summary?.activeCalls ?? 0} tone="amber" icon={<PhoneCall className="h-5 w-5" />} />
        <KPICard label="Agents online" value={summary?.agentsOnline ?? 0} tone="green" icon={<Users className="h-5 w-5" />} />
        <KPICard label="Calls in queue" value={summary?.callsInQueue ?? 0} tone="blue" icon={<Activity className="h-5 w-5" />} />
        <KPICard label="Longest wait" value={`${summary?.longestWait ?? 0}s`} tone="neutral" icon={<Clock className="h-5 w-5" />} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT — answer rate + call volume */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <ScoreCard
              title="Answer rate · last 30 days"
              value={`${answerRate}%`}
              filter={
                <span className="rounded-pill border border-line bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">
                  Past 30 days
                </span>
              }
            >
              <p className="mb-1 text-sm font-medium text-ink-muted">Call volume · today</p>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={hours} margin={{ left: -18, right: 8, top: 4 }}>
                    <defs>
                      <linearGradient id="callVol" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        borderRadius: 14,
                        fontSize: 12,
                        color: "var(--ink)",
                        boxShadow: "0 14px 48px rgba(40,30,15,0.18)",
                      }}
                    />
                    <Area type="monotone" dataKey="count" name="Calls" stroke="var(--accent)" strokeWidth={2.5} fill="url(#callVol)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </ScoreCard>
          </div>

          {/* RIGHT — live telephony (dark) + outcome bars */}
          <div className="flex flex-col gap-6">
            <DarkInfoCard
              title="Live telephony"
              action={<span className="text-xs capitalize text-darkcard-muted">{connectionState}</span>}
            >
              <DarkInfoItem dot="amber" title={`${summary?.activeCalls ?? 0} active calls`} time="in progress now" />
              <DarkInfoItem dot="green" title={`${summary?.agentsOnline ?? 0} agents online`} />
              <DarkInfoItem dot="blue" title={`${summary?.callsInQueue ?? 0} callers in queue`} time={`longest wait ${summary?.longestWait ?? 0}s`} />
            </DarkInfoCard>

            <Card>
              <h3 className="mb-4 text-base font-semibold text-ink">Call outcomes · 30 days</h3>
              <div className="flex flex-col gap-4">
                <ProgressBar label={`Answered (${outcome.answered})`} value={answerRate} tone="green" />
                <ProgressBar label={`Missed (${outcome.missed})`} value={outcomeTotal ? 100 - answerRate : 0} tone="rose" />
                <ProgressBar label="Service level" value={summary?.slaPct ?? 0} tone="amber" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
