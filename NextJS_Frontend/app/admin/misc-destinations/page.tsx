"use client";
/** Admin › Misc destinations — custom routing targets. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Select, Badge, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

interface Dest { id: string; name: string; type: "external_number" | "announcement" | "hangup"; value?: string | null; }
const TYPES = [{ label: "External number", value: "external_number" }, { label: "Announcement", value: "announcement" }, { label: "Hangup", value: "hangup" }];

export default function MiscDestinationsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Dest>("/misc-destinations");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "external_number", value: "" });
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Dest | null>(null);

  async function save() {
    setSaving(true);
    try {
      await api.post("/misc-destinations", { name: form.name, type: form.type, value: form.type === "hangup" ? undefined : form.value });
      toast({ title: "Destination created", variant: "success" });
      setOpen(false); setForm({ name: "", type: "external_number", value: "" }); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/misc-destinations/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Dest>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "type", header: "Type", cell: (r) => <Badge variant="neutral">{r.type.replace("_", " ")}</Badge> },
    { key: "value", header: "Value", cell: (r) => r.value || "—" },
    { key: "actions", header: "", align: "right", cell: (r) => <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button> },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Misc destinations" description="Custom routing targets for calls that don't fit standard extensions."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Create</Button>} />
      <DataTable<Dest> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No destinations." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Create destination"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Create</Button></div>}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Type" options={TYPES} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          {form.type !== "hangup" && <Input label={form.type === "announcement" ? "Sound file" : "External number"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />}
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete destination" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
