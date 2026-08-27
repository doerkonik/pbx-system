"use client";

/** Agent › Reports — the agent's own historical stats + utilization. */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, StatCard, ProgressRing, Tabs, Spinner, type TabItem } from "@/components/ui";

type Gran = "day" | "week" | "month" | "year";
const TABS: TabItem<Gran>[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function AgentReportsPage() {
  const { user, loading: authLoading } = useRequireAuth("agent");
  const [gran, setGran] = useState<Gran>("week");
  const [stats, setStats] = useState<any>(null);
  const [util, setUtil] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, u] = await Promise.allSettled([
      api.get<any>("/reports/agents", { params: { granularity: gran } }),
      api.get<any>("/analytics/agent-utilization", {}),
    ]);
    if (s.status === "fulfilled") {
      const v = s.value;
      setStats(v?.totals ?? (Array.isArray(v) ? v[0] : v?.data?.[0]) ?? v);
    }
    if (u.status === "fulfilled") {
      const v = u.value;
      const pct = Array.isArray(v) ? v[0]?.utilizationPct : v?.utilizationPct ?? v?.pct;
      setUtil(Math.round(Number(pct ?? 0)));
    }
    setLoading(false);
  }, [gran]);

  useEffect(() => {
    if (user) void load();
  }, [user, gran, load]);

  if (authLoading || !user) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  const s = stats ?? {};
  const answerRate = s.callsHandled ? Math.round((s.callsAnswered / s.callsHandled) * 100) : 0;

  return (
    <div>
      <PageHeader title="My reports" description="Your call activity over time." />
      <div className="mb-6"><Tabs tabs={TABS} value={gran} onChange={setGran} variant="pill" /></div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Calls handled" value={s.callsHandled ?? 0} highlight />
            <StatCard label="Answered" value={s.callsAnswered ?? 0} />
            <StatCard label="Missed" value={s.callsMissed ?? 0} />
            <StatCard label="Talk time" value={fmt(s.totalTalkSec ?? 0)} />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card className="flex items-center justify-center p-6"><ProgressRing value={answerRate} caption="Answer rate" /></Card>
            <Card className="flex items-center justify-center p-6"><ProgressRing value={util} caption="Utilization" /></Card>
          </div>
        </div>
      )}
    </div>
  );
}
