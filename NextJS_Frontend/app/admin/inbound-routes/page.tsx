"use client";
/** Admin › Inbound Routes — DID → destination routing (with fallback). */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface InboundRoute {
  id: string; name: string; didNumber?: string | null; cidPattern?: string | null;
  destType: string; destValue?: string | null;
  fallbackDestType?: string | null; fallbackDestValue?: string | null;
  priority: number; isActive: boolean;
}

const DEST_TYPES = [
  { label: "Extension", value: "extension" },
  { label: "Queue", value: "queue" },
  { label: "IVR menu", value: "ivr" },
  { label: "Misc destination", value: "misc_destination" },
  { label: "Voicemail", value: "voicemail" },
  { label: "Conference", value: "conference" },
  { label: "Time condition", value: "time_condition" },
  { label: "Hangup", value: "hangup" },
];
const FALLBACK_TYPES = [{ label: "— None —", value: "" }, ...DEST_TYPES];
const EMPTY = { name: "", didNumber: "", cidPattern: "", destType: "extension", destValue: "", fallbackDestType: "", fallbackDestValue: "", priority: 0 };

export default function InboundRoutesPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<InboundRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InboundRoute | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<InboundRoute | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<InboundRoute[]>("/inbound-routes")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: InboundRoute) {
    setEditing(r);
    setForm({
      name: r.name, didNumber: r.didNumber ?? "", cidPattern: r.cidPattern ?? "",
      destType: r.destType, destValue: r.destValue ?? "",
      fallbackDestType: r.fallbackDestType ?? "", fallbackDestValue: r.fallbackDestValue ?? "", priority: r.priority,
    });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const body: any = {
        name: form.name, didNumber: form.didNumber || undefined, cidPattern: form.cidPattern || undefined,
        destType: form.destType, destValue: form.destValue || undefined,
        fallbackDestType: form.fallbackDestType || undefined,
        fallbackDestValue: form.fallbackDestType ? (form.fallbackDestValue || undefined) : undefined,
        priority: Number(form.priority) || 0,
      };
      if (editing) await api.patch(`/inbound-routes/${editing.id}`, body);
      else await api.post("/inbound-routes", body);
      toast({ title: editing ? "Route updated" : "Route created", variant: "success" });
      setOpen(false); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/inbound-routes/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<InboundRoute>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "did", header: "DID", cell: (r) => r.didNumber || <span className="text-ink-subtle">Any (catch-all)</span> },
    { key: "dest", header: "Destination", cell: (r) => <span><Badge variant="accent">{r.destType}</Badge> {r.destValue}</span> },
    { key: "priority", header: "Priority", cell: (r) => r.priority },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Inbound Routes" description="Send incoming calls (by DID) to a destination."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create route</Button>} />
      <DataTable<InboundRoute> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No inbound routes yet." />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit route" : "Create route"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="DID number" placeholder="Blank = catch-all" value={form.didNumber} onChange={(e) => setForm({ ...form, didNumber: e.target.value })} />
          <Input label="Caller-ID pattern (optional)" value={form.cidPattern} onChange={(e) => setForm({ ...form, cidPattern: e.target.value })} />
          <Input label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <Select label="Destination type" options={DEST_TYPES} value={form.destType} onChange={(e) => setForm({ ...form, destType: e.target.value })} />
          <Input label="Destination value" placeholder="extension / queue / ivr id…" value={form.destValue} onChange={(e) => setForm({ ...form, destValue: e.target.value })} />
          <Select label="Fallback type" options={FALLBACK_TYPES} value={form.fallbackDestType} onChange={(e) => setForm({ ...form, fallbackDestType: e.target.value })} />
          <Input label="Fallback value" disabled={!form.fallbackDestType} value={form.fallbackDestValue} onChange={(e) => setForm({ ...form, fallbackDestValue: e.target.value })} />
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete route" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
