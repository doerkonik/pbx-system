"use client";
/** Admin › CDR — searchable call detail records with drill-in. */
import { useCallback, useEffect, useState } from "react";
import { api, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, DataTable, Modal, Input, Select, Button, Badge, Card, Spinner, type Column } from "@/components/ui";

interface Row { id: number; calldate: string; clid: string; src: string; dst: string; duration: number; billsec: number; disposition: string; uniqueid: string; direction?: string; }
const DISPO = ["", "ANSWERED", "NO ANSWER", "BUSY", "FAILED"].map((d) => ({ label: d || "Any disposition", value: d }));
const DIR = ["", "inbound", "outbound", "internal"].map((d) => ({ label: d || "Any direction", value: d }));

function fmt(sec: number) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${String(s).padStart(2, "0")}`; }

export default function CdrPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [f, setF] = useState({ src: "", dst: "", disposition: "", direction: "", from: "", to: "" });
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.get<PaginatedResult<Row>>("/cdr", { params: { page, limit: 20, src: f.src || undefined, dst: f.dst || undefined, disposition: f.disposition || undefined, direction: f.direction || undefined, from: f.from || undefined, to: f.to || undefined } });
      setRows(res.data); setTotal(res.total);
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [page, f]);
  useEffect(() => { if (user) void load(); }, [user, page, load]);

  const columns: Column<Row>[] = [
    { key: "calldate", header: "Date", cell: (r) => new Date(r.calldate).toLocaleString() },
    { key: "src", header: "From", cell: (r) => r.src },
    { key: "dst", header: "To", cell: (r) => r.dst },
    { key: "direction", header: "Direction", cell: (r) => <Badge variant="neutral">{r.direction ?? "—"}</Badge> },
    { key: "billsec", header: "Talk", align: "right", cell: (r) => fmt(r.billsec) },
    { key: "disposition", header: "Result", cell: (r) => <Badge variant={r.disposition === "ANSWERED" ? "success" : "warn"}>{r.disposition}</Badge> },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Call detail records" description="Search and drill into call history." />
      <Card className="mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Input label="From #" value={f.src} onChange={(e) => setF({ ...f, src: e.target.value })} />
        <Input label="To #" value={f.dst} onChange={(e) => setF({ ...f, dst: e.target.value })} />
        <Select label="Disposition" options={DISPO} value={f.disposition} onChange={(e) => setF({ ...f, disposition: e.target.value })} />
        <Select label="Direction" options={DIR} value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} />
        <Input label="From date" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Input label="To date" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <div className="col-span-full"><Button variant="secondary" onClick={() => { setPage(1); void load(); }}>Apply filters</Button></div>
      </Card>
      <DataTable<Row> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={load}
        onRowClick={async (r) => { try { setDetail(await api.get(`/cdr/${r.id}`)); } catch { setDetail(r); } }}
        emptyMessage="No records." pagination={{ page, pageSize: 20, total, onPageChange: setPage }} />
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Call detail">
        {detail && (
          <div className="space-y-1.5 text-sm">
            {Object.entries(detail).filter(([k]) => k !== "recording").map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-1"><span className="text-ink-muted">{k}</span><span className="text-right font-medium text-ink">{String(v ?? "—")}</span></div>
            ))}
            {detail.recording?.id && (
              <a className="mt-3 inline-block text-accent underline" href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/recordings/${detail.recording.id}/download`} target="_blank" rel="noreferrer">Download recording</a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
