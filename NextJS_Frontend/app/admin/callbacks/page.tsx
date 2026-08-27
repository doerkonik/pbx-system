"use client";
/** Admin/Supervisor › Callbacks — queued call-back requests. */
import { useState } from "react";
import { Plus, PhoneOutgoing, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import {
  PageHeader, DataTable, Modal, Button, Input, Badge, Spinner,
  useToast, type Column, type BadgeVariant,
} from "@/components/ui";

interface Callback {
  id: string; queueName: string; phone: string; callerName?: string | null;
  priority: number; status: string; attempts: number; createdAt: string;
}
const EMPTY = { queueName: "", phone: "", callerName: "", priority: 0 };
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warn", dialing: "info", done: "success", cancelled: "neutral", failed: "danger",
};

export default function CallbacksPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Callback>("/callbacks");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.post("/callbacks", {
        queueName: form.queueName, phone: form.phone,
        callerName: form.callerName || undefined, priority: Number(form.priority) || 0,
      });
      toast({ title: "Callback queued", variant: "success" });
      setOpen(false); setForm(EMPTY); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function act(id: string, action: "dial" | "cancel") {
    try {
      await api.post(`/callbacks/${id}/${action}`);
      toast({ title: action === "dial" ? "Dialing…" : "Cancelled", variant: "success" });
      await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }

  const columns: Column<Callback>[] = [
    { key: "phone", header: "Phone", cell: (r) => <span className="font-medium">{r.phone}</span> },
    { key: "name", header: "Name", cell: (r) => r.callerName || <span className="text-ink-subtle">—</span> },
    { key: "queue", header: "Queue", cell: (r) => r.queueName },
    { key: "attempts", header: "Attempts", cell: (r) => r.attempts },
    { key: "status", header: "Status", cell: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? "neutral"}>{r.status}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        {["pending", "failed"].includes(r.status) && (
          <Button variant="ghost" size="icon" title="Dial now" onClick={() => act(r.id, "dial")}><PhoneOutgoing className="h-4 w-4 text-success" /></Button>
        )}
        {!["done", "cancelled"].includes(r.status) && (
          <Button variant="ghost" size="icon" title="Cancel" onClick={() => act(r.id, "cancel")}><XCircle className="h-4 w-4 text-danger" /></Button>
        )}
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Callbacks" description="Queued call-back requests."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(EMPTY); setOpen(true); }}>Queue callback</Button>} />
      <DataTable<Callback> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No callbacks." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="md" title="Queue callback"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Queue</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Queue name" value={form.queueName} onChange={(e) => setForm({ ...form, queueName: e.target.value })} />
          <Input label="Caller name (optional)" value={form.callerName} onChange={(e) => setForm({ ...form, callerName: e.target.value })} />
          <Input label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
