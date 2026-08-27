"use client";
/** Admin › Blacklist — blocked numbers (inbound/outbound). */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface Entry { id: string; number: string; direction: "inbound" | "outbound" | "both"; reason?: string | null; isActive: boolean; }
const DIRS = [{ label: "Both", value: "both" }, { label: "Inbound", value: "inbound" }, { label: "Outbound", value: "outbound" }];

export default function BlacklistPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Entry>("/blacklist");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: "", direction: "both", reason: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Entry | null>(null);

  async function save() {
    if (!/^\+?[0-9*#]{1,32}$/.test(form.number)) { toast({ title: "Invalid number", variant: "error" }); return; }
    setSaving(true);
    try {
      await api.post("/blacklist", { number: form.number, direction: form.direction, reason: form.reason || undefined, isActive: form.isActive });
      toast({ title: "Number blocked", variant: "success" });
      setOpen(false); setForm({ number: "", direction: "both", reason: "", isActive: true });
      await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!del) return;
    await api.del(`/blacklist/${del.id}`); setDel(null); await list.reload();
    toast({ title: "Removed", variant: "success" });
  }

  const columns: Column<Entry>[] = [
    { key: "number", header: "Number", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "direction", header: "Direction", cell: (r) => <Badge variant="neutral">{r.direction}</Badge> },
    { key: "reason", header: "Reason", cell: (r) => r.reason || "—" },
    { key: "isActive", header: "Active", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Yes" : "No"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button> },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Blacklist" description="Block numbers from calling in or out."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add number</Button>} />
      <div className="mb-4 max-w-sm"><Input placeholder="Search numbers…" value={list.search} onChange={(e) => list.setSearch(e.target.value)} /></div>
      <DataTable<Entry> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No blocked numbers." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Block a number"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Block</Button></div>}>
        <div className="space-y-4">
          <Input label="Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="e.g. +8801700000000" />
          <Select label="Direction" options={DIRS} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} />
          <Input label="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Optional" />
          <Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Remove number" description={del ? `Unblock ${del.number}?` : ""} confirmLabel="Remove" destructive />
    </div>
  );
}
