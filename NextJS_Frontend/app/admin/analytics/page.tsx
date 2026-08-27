"use client";
/** Admin › Analytics — deeper insights from rollups + queue_log. */
import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Input, Button, Spinner } from "@/components/ui";

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [range, setRange] = useState({ from: "", to: "" });
  const [wait, setWait] = useState<any[]>([]);
  const [answer, setAnswer] = useState<any[]>([]);
  const [peak, setPeak] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const p = range.from ? range : {};
    const [w, a, pk] = await Promise.allSettled([
      api.get<any>("/analytics/wait-distribution", { params: p }),
      api.get<any>("/analytics/answer-rates", { params: p }),
      api.get<any>("/analytics/peak-hours", { params: p }),
    ]);
    const arr = (v: any) => (Array.isArray(v) ? v : v?.data ?? v?.buckets ?? []);
    if (w.status === "fulfilled") setWait(arr(w.value));
    if (a.status === "fulfilled") setAnswer(arr(a.value));
    if (pk.status === "fulfilled") setPeak(arr(pk.value));
    setLoading(false);
  }, [range]);
  useEffect(() => { if (user) void load(); }, [user, load]);

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Analytics" description="Wait-time distribution, answer rates, and peak-hour trends." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input type="date" label="From" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" label="To" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        <Button variant="secondary" onClick={load}>Apply</Button>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-ink">Wait-time distribution</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={wait}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-ink">Peak hours</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={peak}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <h3 className="mb-4 text-base font-semibold text-ink">Answer vs abandon by queue</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={answer}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="queueName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="answered" fill="var(--success)" name="Answered" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="abandoned" fill="var(--danger)" name="Abandoned" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
