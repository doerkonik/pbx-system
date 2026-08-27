"use client";
/** Admin › SLA Thresholds — per-queue alerting limits. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface Sla {
  id: string; queueName: string; maxWaitSec: number; maxCallsWaiting: number;
  minAvailableAgents: number; serviceLevelTargetSec: number; isActive: boolean;
}
const EMPTY = { queueName: "", maxWaitSec: 60, maxCallsWaiting: 10, minAvailableAgents: 1, serviceLevelTargetSec: 20, isActive: true };

export default function SlaThresholdsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<Sla[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sla | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Sla | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<Sla[]>("/monitoring/sla-thresholds")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(s: Sla) { setEditing(s); setForm({ ...s }); setOpen(true); }
  async function save() {
    setSaving(true);
    try {
      const body: any = {
        queueName: form.queueName, maxWaitSec: Number(form.maxWaitSec), maxCallsWaiting: Number(form.maxCallsWaiting),
        minAvailableAgents: Number(form.minAvailableAgents), serviceLevelTargetSec: Number(form.serviceLevelTargetSec), isActive: form.isActive,
      };
      if (editing) await api.patch(`/monitoring/sla-thresholds/${editing.id}`, body);
      else await api.post("/monitoring/sla-thresholds", body);
      toast({ title: editing ? "Threshold updated" : "Threshold created", variant: "success" });
      setOpen(false); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/monitoring/sla-thresholds/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Sla>[] = [
    { key: "queueName", header: "Queue", cell: (r) => <span className="font-medium">{r.queueName}</span> },
    { key: "maxWaitSec", header: "Max wait", cell: (r) => `${r.maxWaitSec}s` },
    { key: "maxCallsWaiting", header: "Max waiting", cell: (r) => r.maxCallsWaiting },
    { key: "minAvailableAgents", header: "Min agents", cell: (r) => r.minAvailableAgents },
    { key: "sl", header: "SL target", cell: (r) => `${r.serviceLevelTargetSec}s` },
    { key: "status", header: "Status", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="SLA Thresholds" description="When to raise queue SLA alerts."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add threshold</Button>} />
      <DataTable<Sla> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No SLA thresholds yet." />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit threshold" : "Add threshold"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Add"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label="Queue name" value={form.queueName} disabled={!!editing} onChange={(e) => setForm({ ...form, queueName: e.target.value })} /></div>
          <Input label="Max wait (sec)" type="number" value={form.maxWaitSec} onChange={(e) => setForm({ ...form, maxWaitSec: e.target.value })} />
          <Input label="Max callers waiting" type="number" value={form.maxCallsWaiting} onChange={(e) => setForm({ ...form, maxCallsWaiting: e.target.value })} />
          <Input label="Min available agents" type="number" value={form.minAvailableAgents} onChange={(e) => setForm({ ...form, minAvailableAgents: e.target.value })} />
          <Input label="Service-level target (sec)" type="number" value={form.serviceLevelTargetSec} onChange={(e) => setForm({ ...form, serviceLevelTargetSec: e.target.value })} />
          <div className="sm:col-span-2"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete threshold" description={del ? `Delete SLA threshold for ${del.queueName}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
