"use client";
/** Agent › Breaks — take a reason-coded break (dual-write pause) and view history. */
import { useCallback, useEffect, useState } from "react";
import { Coffee, Play } from "lucide-react";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, Card, Button, Select, DataTable, Badge, Spinner, useToast, type Column,
} from "@/components/ui";

interface Reason { id: string; code: string; label: string }
interface Break { id: string; reason: string | null; startedAt: string; endedAt: string | null; durationSec: number | null }

function fmt(sec: number | null): string { if (sec == null) return "—"; const m = Math.floor(sec / 60); return `${m}m ${sec % 60}s`; }

export default function AgentBreaksPage() {
  const { user, loading: authLoading } = useRequireAuth("agent");
  const { toast } = useToast();

  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<Break | null>(null);
  const [rows, setRows] = useState<Break[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const labelForCode = (code: string | null) =>
    reasons.find((r) => r.code === code)?.label ?? code ?? "—";

  const load = useCallback(async () => {
    setLoading(true);
    const [rs, cur, hist] = await Promise.allSettled([
      api.get<Reason[]>("/breaks/reasons"),
      api.get<Break | null>("/breaks/current"),
      api.get<PaginatedResult<Break>>("/breaks/history", { params: { page, limit: 15 } }),
    ]);
    if (rs.status === "fulfilled") {
      setReasons(rs.value);
      if (!reason && rs.value[0]) setReason(rs.value[0].code);
    }
    if (cur.status === "fulfilled") setCurrent(cur.value);
    if (hist.status === "fulfilled") { setRows(hist.value.data); setTotal(hist.value.total); }
    setLoading(false);
  }, [page, reason]);

  useEffect(() => { if (user) void load(); }, [user, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!current) return;
    const start = new Date(current.startedAt).getTime();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [current]);

  async function startBreak() {
    setBusy(true);
    try {
      await api.post("/breaks/start", { reason });
      toast({ title: "Break started", variant: "success" });
      await load();
    } catch (e) { toast({ title: "Could not start break", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setBusy(false); }
  }
  async function endBreak() {
    setBusy(true);
    try {
      await api.post("/breaks/end");
      toast({ title: "Break ended", variant: "success" });
      await load();
    } catch (e) { toast({ title: "Could not end break", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setBusy(false); }
  }

  const columns: Column<Break>[] = [
    { key: "reason", header: "Reason", cell: (r) => <Badge variant="neutral">{labelForCode(r.reason)}</Badge> },
    { key: "startedAt", header: "Started", cell: (r) => new Date(r.startedAt).toLocaleString() },
    { key: "endedAt", header: "Ended", cell: (r) => (r.endedAt ? new Date(r.endedAt).toLocaleString() : "Ongoing") },
    { key: "durationSec", header: "Duration", align: "right", cell: (r) => fmt(r.durationSec) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Breaks" description="Mark yourself unavailable with a reason." />
      <Card className="mb-6 p-5">
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Coffee className="h-5 w-5 text-warn" />
              <div>
                <p className="font-medium text-ink">On break · {labelForCode(current.reason)}</p>
                <p className="text-xs tabular-nums text-ink-muted">{fmt(elapsed)} elapsed</p>
              </div>
            </div>
            <Button variant="primary" loading={busy} onClick={endBreak} leftIcon={<Play className="h-4 w-4" />}>End break</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}
              options={reasons.map((r) => ({ label: r.label, value: r.code }))} containerClassName="max-w-xs" />
            <Button variant="primary" loading={busy} disabled={!reason} onClick={startBreak} leftIcon={<Coffee className="h-4 w-4" />}>Start break</Button>
          </div>
        )}
      </Card>

      <DataTable<Break> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading}
        emptyMessage="No breaks recorded yet." pagination={{ page, pageSize: 15, total, onPageChange: setPage }} />
    </div>
  );
}
