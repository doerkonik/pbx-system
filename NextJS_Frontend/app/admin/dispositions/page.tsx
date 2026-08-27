"use client";
/** Admin › Dispositions — agent wrap-up codes. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface DispositionCode {
  id: string; code: string; label: string; category: string;
  requiresNote: boolean; sortOrder: number; isActive: boolean;
}
const CATEGORIES = [
  { label: "Sale", value: "sale" },
  { label: "Callback", value: "callback" },
  { label: "No answer", value: "no_answer" },
  { label: "Not interested", value: "not_interested" },
  { label: "Complaint", value: "complaint" },
  { label: "Support", value: "support" },
  { label: "Other", value: "other" },
];
const EMPTY = { code: "", label: "", category: "other", requiresNote: false, sortOrder: 0, isActive: true };

export default function DispositionsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<DispositionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DispositionCode | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<DispositionCode | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<DispositionCode[]>("/disposition-codes")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(d: DispositionCode) {
    setEditing(d);
    setForm({ code: d.code, label: d.label, category: d.category, requiresNote: d.requiresNote, sortOrder: d.sortOrder, isActive: d.isActive });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const body: any = { code: form.code, label: form.label, category: form.category, requiresNote: form.requiresNote, sortOrder: Number(form.sortOrder) || 0, isActive: form.isActive };
      if (editing) await api.patch(`/disposition-codes/${editing.id}`, body);
      else await api.post("/disposition-codes", body);
      toast({ title: editing ? "Code updated" : "Code created", variant: "success" });
      setOpen(false); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/disposition-codes/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<DispositionCode>[] = [
    { key: "code", header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
    { key: "label", header: "Label", cell: (r) => r.label },
    { key: "category", header: "Category", cell: (r) => <Badge variant="neutral">{r.category}</Badge> },
    { key: "note", header: "Note", cell: (r) => r.requiresNote ? <Badge variant="warn">Required</Badge> : <span className="text-ink-subtle">—</span> },
    { key: "status", header: "Status", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Dispositions" description="Wrap-up codes agents pick after a call."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add code</Button>} />
      <DataTable<DispositionCode> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No disposition codes yet." />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="md" title={editing ? "Edit code" : "Add code"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Add"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Input label="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Select label="Category" options={CATEGORIES} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input label="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          <div className="sm:col-span-2 flex flex-col gap-3">
            <Toggle checked={form.requiresNote} onCheckedChange={(v) => setForm({ ...form, requiresNote: v })} label="Require a note" />
            <Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete code" description={del ? `Delete ${del.code}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
