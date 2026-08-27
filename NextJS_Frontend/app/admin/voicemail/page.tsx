"use client";
/** Admin › Voicemail — mailboxes + voicemail-to-email. */
import { useState } from "react";
import { Plus, Pencil, Trash2, Mail } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import {
  PageHeader, DataTable, Modal, Button, Input, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface Vm {
  uniqueid: number; mailbox: string; context: string; fullname?: string | null;
  email?: string | null; attach: string; deletevoicemail: number; tz?: string | null; maxmsg?: number | null;
}
const EMPTY = { mailbox: "", pin: "", fullName: "", email: "", attachToEmail: true, deleteAfterEmail: false, timezone: "", maxMessages: 100 };

export default function VoicemailPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Vm>("/voicemail");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vm | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Vm | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(v: Vm) {
    setEditing(v);
    setForm({
      mailbox: v.mailbox, pin: "", fullName: v.fullname ?? "", email: v.email ?? "",
      attachToEmail: v.attach === "yes", deleteAfterEmail: v.deletevoicemail === 1,
      timezone: v.tz ?? "", maxMessages: v.maxmsg ?? 100,
    });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const body: any = {
        fullName: form.fullName || undefined, email: form.email || undefined,
        attachToEmail: form.attachToEmail, deleteAfterEmail: form.deleteAfterEmail,
        timezone: form.timezone || undefined, maxMessages: Number(form.maxMessages) || undefined,
      };
      if (form.pin) body.pin = form.pin;
      if (editing) await api.patch(`/voicemail/${editing.uniqueid}`, body);
      else await api.post("/voicemail", { ...body, mailbox: form.mailbox, pin: form.pin });
      toast({ title: editing ? "Mailbox updated" : "Mailbox created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/voicemail/${del.uniqueid}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Vm>[] = [
    { key: "mailbox", header: "Mailbox", cell: (r) => <span className="font-medium">{r.mailbox}</span> },
    { key: "fullname", header: "Name", cell: (r) => r.fullname || <span className="text-ink-subtle">—</span> },
    { key: "email", header: "Email", cell: (r) => r.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-ink-subtle" />{r.email}</span> : <span className="text-ink-subtle">—</span> },
    { key: "vte", header: "→ Email", cell: (r) => <Badge variant={r.attach === "yes" ? "success" : "neutral"}>{r.attach === "yes" ? "On" : "Off"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Voicemail" description="Mailboxes and voicemail-to-email."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add mailbox</Button>} />
      <DataTable<Vm> columns={columns} data={list.rows} rowKey={(r) => String(r.uniqueid)} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No mailboxes yet." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit mailbox" : "Add mailbox"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Add"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Mailbox (extension)" value={form.mailbox} disabled={!!editing} onChange={(e) => setForm({ ...form, mailbox: e.target.value })} />
          <Input label="PIN" type="password" placeholder={editing ? "Unchanged" : ""} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Timezone" placeholder="e.g. Asia/Dhaka" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          <Input label="Max messages" type="number" value={form.maxMessages} onChange={(e) => setForm({ ...form, maxMessages: e.target.value })} />
          <div className="sm:col-span-2 flex flex-col gap-3">
            <Toggle checked={form.attachToEmail} onCheckedChange={(v) => setForm({ ...form, attachToEmail: v })} label="Attach recording to email" />
            <Toggle checked={form.deleteAfterEmail} onCheckedChange={(v) => setForm({ ...form, deleteAfterEmail: v })} label="Delete after emailing (email-only)" />
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete mailbox" description={del ? `Delete mailbox ${del.mailbox}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
