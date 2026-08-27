"use client";
/** Admin › DIDs — inbound phone-number inventory. */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface Did {
  id: string; number: string; description?: string | null;
  trunkId?: string | null; isActive: boolean;
}
const EMPTY = { number: "", description: "", trunkId: "", isActive: true };

export default function DidsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Did>("/dids");
  const [trunks, setTrunks] = useState<{ label: string; value: string }[]>([{ label: "— None —", value: "" }]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Did | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Did | null>(null);

  useEffect(() => {
    void api.get<{ data: { id: string; name: string }[] }>("/trunks", { params: { limit: 200 } })
      .then((r) => setTrunks([{ label: "— None —", value: "" }, ...r.data.map((t) => ({ label: t.name, value: t.id }))]))
      .catch(() => undefined);
  }, []);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(d: Did) {
    setEditing(d);
    setForm({ number: d.number, description: d.description ?? "", trunkId: d.trunkId ?? "", isActive: d.isActive });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const body: any = { number: form.number, description: form.description || undefined, trunkId: form.trunkId || undefined, isActive: form.isActive };
      if (editing) await api.patch(`/dids/${editing.id}`, body);
      else await api.post("/dids", body);
      toast({ title: editing ? "DID updated" : "DID created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/dids/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Did>[] = [
    { key: "number", header: "Number", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "description", header: "Description", cell: (r) => r.description || <span className="text-ink-subtle">—</span> },
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
      <PageHeader title="DIDs" description="Inbound phone numbers you own."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add DID</Button>} />
      <DataTable<Did> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No DIDs yet." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit DID" : "Add DID"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Add"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <Select label="Arrival trunk" options={trunks} value={form.trunkId} onChange={(e) => setForm({ ...form, trunkId: e.target.value })} />
          <div className="sm:col-span-2"><Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete DID" description={del ? `Delete ${del.number}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
