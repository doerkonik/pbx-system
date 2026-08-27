"use client";
/** Admin › Trunks — SIP provider/PSTN connections with live registration status. */
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, StatusPill, Spinner,
  ConfirmDialog, useToast, type Column, type StatusPillVariant,
} from "@/components/ui";

interface Trunk {
  id: string; name: string; authType: "registration" | "ip"; sipServer: string; sipPort: number;
  username?: string | null; matchIp?: string | null; codecs?: string | null; failoverOrder: number; isActive: boolean;
  registration?: { presence: string; contactStatus?: string } | null;
}
const AUTH = [{ label: "Registration", value: "registration" }, { label: "IP auth", value: "ip" }];
const EMPTY = { name: "", authType: "registration", sipServer: "", sipPort: 5060, username: "", password: "", matchIp: "", codecs: "ulaw,alaw", failoverOrder: 0, isActive: true };

export default function TrunksPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Trunk>("/trunks");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trunk | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Trunk | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(t: Trunk) { setEditing(t); setForm({ ...EMPTY, ...t, password: "" }); setOpen(true); }

  async function save() {
    setSaving(true);
    try {
      const body: any = {
        name: form.name, authType: form.authType, sipServer: form.sipServer, sipPort: Number(form.sipPort),
        codecs: form.codecs || undefined, failoverOrder: Number(form.failoverOrder), isActive: form.isActive,
      };
      if (form.authType === "registration") { body.username = form.username; if (form.password) body.password = form.password; }
      else body.matchIp = form.matchIp;
      if (editing) await api.patch(`/trunks/${editing.id}`, body);
      else await api.post("/trunks", body);
      toast({ title: editing ? "Trunk updated" : "Trunk created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/trunks/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }

  const statusVariant = (p?: string): StatusPillVariant => (p === "idle" || p === "in_call" ? "idle" : "offline");
  const columns: Column<Trunk>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "authType", header: "Auth", cell: (r) => <Badge variant="neutral">{r.authType}</Badge> },
    { key: "sipServer", header: "Server", cell: (r) => `${r.sipServer}:${r.sipPort}` },
    { key: "status", header: "Status", cell: (r) => <StatusPill variant={statusVariant(r.registration?.presence)} label={r.registration?.contactStatus || "Unknown"} dot /> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Trunks" description="SIP provider and PSTN connections."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create trunk</Button>} />
      <DataTable<Trunk> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No trunks." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit trunk" : "Create trunk"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} disabled={!!editing} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Auth type" options={AUTH} value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })} />
          <Input label="SIP server" value={form.sipServer} onChange={(e) => setForm({ ...form, sipServer: e.target.value })} />
          <Input label="SIP port" type="number" value={form.sipPort} onChange={(e) => setForm({ ...form, sipPort: e.target.value })} />
          {form.authType === "registration" ? (
            <>
              <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              <Input label="Password" type="password" placeholder={editing ? "Unchanged" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </>
          ) : (
            <Input label="Match IP / CIDR" value={form.matchIp} onChange={(e) => setForm({ ...form, matchIp: e.target.value })} />
          )}
          <Input label="Codecs" value={form.codecs} onChange={(e) => setForm({ ...form, codecs: e.target.value })} />
          <Input label="Failover order" type="number" value={form.failoverOrder} onChange={(e) => setForm({ ...form, failoverOrder: e.target.value })} />
          <div className="sm:col-span-2"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete trunk" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
