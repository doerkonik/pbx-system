"use client";
/** Admin › Breaks — configure break reasons + oversee agent break activity. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Coffee } from "lucide-react";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, Card, DataTable, Modal, Button, Input, Toggle, Badge, StatusPill,
  Spinner, ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface Reason { id: string; code: string; label: string; isActive: boolean; sortOrder: number }
interface Break { id: string; agentId: string; extension: string; reason: string | null; startedAt: string; endedAt: string | null; durationSec: number | null }
interface AgentState { extension: string; presence: string; reason?: string }

const EMPTY = { code: "", label: "", isActive: true, sortOrder: 0 };
function fmt(s: number | null) { if (s == null) return "Ongoing"; const m = Math.floor(s / 60); return `${m}m ${s % 60}s`; }

export default function AdminBreaksPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();

  // --- reasons config ---
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [rLoading, setRLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reason | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Reason | null>(null);

  // --- oversight ---
  const [rows, setRows] = useState<Break[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [onBreak, setOnBreak] = useState<AgentState[]>([]);

  const labelForCode = (code: string | null) =>
    reasons.find((r) => r.code === code)?.label ?? code ?? "—";

  const loadReasons = useCallback(async () => {
    setRLoading(true);
    try { setReasons(await api.get<Reason[]>("/breaks/reasons/all")); }
    finally { setRLoading(false); }
  }, []);

  const loadOversight = useCallback(async () => {
    const [h, a] = await Promise.allSettled([
      api.get<PaginatedResult<Break>>("/breaks/history", { params: { page, limit: 20 } }),
      api.get<AgentState[]>("/dashboard/agents"),
    ]);
    if (h.status === "fulfilled") { setRows(h.value.data); setTotal(h.value.total); }
    if (a.status === "fulfilled") setOnBreak((a.value ?? []).filter((x) => x.presence === "paused"));
  }, [page]);

  useEffect(() => { if (user) { void loadReasons(); } }, [user, loadReasons]);
  useEffect(() => { if (user) { void loadOversight(); } }, [user, page, loadOversight]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: Reason) { setEditing(r); setForm({ code: r.code, label: r.label, isActive: r.isActive, sortOrder: r.sortOrder }); setOpen(true); }

  async function save() {
    if (!/^[a-z0-9_-]{2,40}$/.test(form.code)) { toast({ title: "Code must be 2-40 chars: a-z 0-9 _ -", variant: "error" }); return; }
    if (!form.label.trim()) { toast({ title: "Label is required", variant: "error" }); return; }
    setSaving(true);
    try {
      const body = { code: form.code, label: form.label, isActive: form.isActive, sortOrder: Number(form.sortOrder) || 0 };
      if (editing) await api.patch(`/breaks/reasons/${editing.id}`, body);
      else await api.post("/breaks/reasons", body);
      toast({ title: editing ? "Reason updated" : "Reason created", variant: "success" });
      setOpen(false); await loadReasons();
    } catch (e) { toast({ title: "Save failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/breaks/reasons/${del.id}`); setDel(null); await loadReasons(); toast({ title: "Reason deleted", variant: "success" }); }

  const reasonCols: Column<Reason>[] = [
    { key: "sortOrder", header: "#", width: "1%", cell: (r) => r.sortOrder },
    { key: "label", header: "Reason", cell: (r) => <span className="font-medium text-ink">{r.label}</span> },
    { key: "code", header: "Code", cell: (r) => <code className="text-xs text-ink-muted">{r.code}</code> },
    { key: "isActive", header: "Status", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  const histCols: Column<Break>[] = [
    { key: "extension", header: "Extension", cell: (r) => <span className="font-medium">{r.extension}</span> },
    { key: "reason", header: "Reason", cell: (r) => <Badge variant="neutral">{labelForCode(r.reason)}</Badge> },
    { key: "startedAt", header: "Started", cell: (r) => new Date(r.startedAt).toLocaleString() },
    { key: "endedAt", header: "Ended", cell: (r) => (r.endedAt ? new Date(r.endedAt).toLocaleString() : "Ongoing") },
    { key: "durationSec", header: "Duration", align: "right", cell: (r) => fmt(r.durationSec) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Breaks" description="Configure break reasons and monitor agent break activity."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add reason</Button>} />

      {/* Reason configuration */}
      <Card className="mb-6" flush>
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold text-ink">Break reasons</h3>
          <p className="mt-0.5 text-sm text-ink-muted">These are the options agents choose from when taking a break.</p>
        </div>
        <div className="p-5">
          <DataTable<Reason> columns={reasonCols} data={reasons} rowKey={(r) => r.id} loading={rLoading}
            emptyMessage="No break reasons yet — add one." />
        </div>
      </Card>

      {/* Currently on break */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Coffee className="h-4 w-4 text-warn" />
          <h3 className="text-sm font-semibold text-ink">Currently on break ({onBreak.length})</h3>
        </div>
        {onBreak.length === 0 ? <p className="text-sm text-ink-muted">No agents on break.</p> : (
          <div className="flex flex-wrap gap-2">
            {onBreak.map((a) => <StatusPill key={a.extension} variant="paused" label={`${a.extension}${a.reason ? ` · ${labelForCode(a.reason)}` : ""}`} dot />)}
          </div>
        )}
      </Card>

      {/* History */}
      <h3 className="mb-3 text-sm font-semibold text-ink">Break history</h3>
      <DataTable<Break> columns={histCols} data={rows} rowKey={(r) => r.id} emptyMessage="No break history."
        pagination={{ page, pageSize: 20, total, onPageChange: setPage }} />

      {/* Reason create/edit modal */}
      <Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? "Edit break reason" : "Add break reason"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="space-y-4">
          <Input label="Label" placeholder="e.g. Lunch" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input label="Code" placeholder="e.g. lunch" hint="Lowercase id stored on records. Cannot contain spaces." value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active (agents can select it)" />
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete break reason"
        description={del ? `Delete "${del.label}"? Past records keep their reason.` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
