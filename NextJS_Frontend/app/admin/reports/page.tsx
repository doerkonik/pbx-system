"use client";
/** Admin › Reports — summarized volume/activity from rollup tables + CSV export. */
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, Card, StatCard, ProgressRing, DataTable, Tabs, Button, Input, Spinner,
  type Column, type TabItem,
} from "@/components/ui";

type Gran = "day" | "week" | "month" | "year" | "custom";
const TABS: TabItem<Gran>[] = ["day", "week", "month", "year", "custom"].map((g) => ({ value: g as Gran, label: g[0].toUpperCase() + g.slice(1) }));

async function downloadCsv(path: string, params: Record<string, string>, filename: string) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}?${qs}`, { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [gran, setGran] = useState<Gran>("week");
  const [range, setRange] = useState({ from: "", to: "" });
  const [summary, setSummary] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const params = useCallback(() => {
    const p: Record<string, string> = { granularity: gran };
    if (range.from) p.from = range.from; if (range.to) p.to = range.to; return p;
  }, [gran, range]);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, a, q] = await Promise.allSettled([
      api.get<any>("/reports/summary", { params: range.from ? range : {} }),
      api.get<any>("/reports/agents", { params: params() }),
      api.get<any>("/reports/queues", { params: params() }),
    ]);
    if (s.status === "fulfilled") setSummary(s.value);
    if (a.status === "fulfilled") setAgents(Array.isArray(a.value) ? a.value : a.value?.data ?? []);
    if (q.status === "fulfilled") setQueues(Array.isArray(q.value) ? q.value : q.value?.data ?? []);
    setLoading(false);
  }, [params, range]);
  useEffect(() => { if (user) void load(); }, [user, gran, load]);

  const agentCols: Column<any>[] = [
    { key: "extension", header: "Agent", cell: (r) => r.extension ?? r.agentId },
    { key: "callsHandled", header: "Handled", align: "right", cell: (r) => r.callsHandled ?? 0 },
    { key: "callsAnswered", header: "Answered", align: "right", cell: (r) => r.callsAnswered ?? 0 },
    { key: "avgHandleSec", header: "Avg handle", align: "right", cell: (r) => `${Math.round((r.avgHandleSec ?? 0))}s` },
  ];
  const queueCols: Column<any>[] = [
    { key: "queueName", header: "Queue", cell: (r) => r.queueName ?? r.queue },
    { key: "offered", header: "Offered", align: "right", cell: (r) => r.offered ?? 0 },
    { key: "answered", header: "Answered", align: "right", cell: (r) => r.answered ?? 0 },
    { key: "abandoned", header: "Abandoned", align: "right", cell: (r) => r.abandoned ?? 0 },
    { key: "serviceLevelPct", header: "SLA%", align: "right", cell: (r) => `${Math.round(Number(r.serviceLevelPct ?? 0))}%` },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  const answerRate = summary?.answerRatePct ?? (summary?.totalCalls ? Math.round((summary.answered / summary.totalCalls) * 100) : 0);

  return (
    <div>
      <PageHeader title="Reports" description="Call volume and agent/queue activity from nightly rollups." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Tabs tabs={TABS} value={gran} onChange={setGran} variant="pill" />
        {gran === "custom" && (
          <>
            <Input type="date" label="From" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            <Input type="date" label="To" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            <Button variant="secondary" onClick={load}>Apply</Button>
          </>
        )}
      </div>

      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total calls" value={summary?.totalCalls ?? 0} highlight />
            <StatCard label="Answered" value={summary?.answered ?? 0} />
            <StatCard label="Avg handle" value={`${Math.round(summary?.avgHandleSec ?? 0)}s`} />
            <Card className="flex items-center justify-center p-3"><ProgressRing value={answerRate} size={72} caption="Answer" /></Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-ink">Queue performance</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={queues}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="queueName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="answered" fill="var(--success)" name="Answered" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="abandoned" fill="var(--warn)" name="Abandoned" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-base font-semibold text-ink">Agents</h3>
                <Button variant="ghost" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv("/reports/agents/export", params(), "agents.csv")}>CSV</Button></div>
              <DataTable columns={agentCols} data={agents} rowKey={(r) => r.agentId ?? r.extension} emptyMessage="No data." />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-base font-semibold text-ink">Queues</h3>
                <Button variant="ghost" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={() => downloadCsv("/reports/queues/export", params(), "queues.csv")}>CSV</Button></div>
              <DataTable columns={queueCols} data={queues} rowKey={(r) => r.queueName ?? r.queue} emptyMessage="No data." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
