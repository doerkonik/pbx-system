"use client";
/** Admin › Users — create/manage users & agents, assign extensions, reset creds. */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

interface U { id: string; username: string; email?: string | null; fullName?: string | null; role: "admin" | "agent"; extension?: string | null; isActive: boolean; }
interface Ext { id: string; extensionNumber: string; }
const ROLES = [{ label: "Agent", value: "agent" }, { label: "Admin", value: "admin" }];
const EMPTY = { username: "", password: "", role: "agent", email: "", fullName: "", extension: "", isActive: true };

export default function UsersPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<U>("/users");
  const [exts, setExts] = useState<Ext[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<U | null>(null);
  const [pwTarget, setPwTarget] = useState<U | null>(null);
  const [newPw, setNewPw] = useState("");

  useEffect(() => { void api.get<PaginatedResult<Ext>>("/extensions", { params: { limit: 200 } }).then((r) => setExts(r.data)).catch(() => undefined); }, []);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(u: U) { setEditing(u); setForm({ ...EMPTY, ...u, password: "", email: u.email ?? "", fullName: u.fullName ?? "", extension: u.extension ?? "" }); setOpen(true); }

  async function save() {
    setSaving(true);
    try {
      const body: any = { username: form.username, role: form.role, email: form.email || undefined, fullName: form.fullName || undefined, extension: form.extension || undefined, isActive: form.isActive };
      if (editing) { if (form.password) body.password = form.password; await api.patch(`/users/${editing.id}`, body); }
      else { body.password = form.password; await api.post("/users", body); }
      toast({ title: editing ? "User updated" : "User created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/users/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }
  async function resetPw() {
    if (!pwTarget) return;
    try { await api.post(`/users/${pwTarget.id}/reset-password`, { newPassword: newPw }); toast({ title: "Password reset", variant: "success" }); setPwTarget(null); setNewPw(""); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }

  const columns: Column<U>[] = [
    { key: "username", header: "Username", cell: (r) => <span className="font-medium">{r.username}</span> },
    { key: "fullName", header: "Name", cell: (r) => r.fullName || "—" },
    { key: "role", header: "Role", cell: (r) => <Badge variant={r.role === "admin" ? "accent" : "neutral"}>{r.role}</Badge> },
    { key: "extension", header: "Extension", cell: (r) => r.extension || "—" },
    { key: "isActive", header: "Active", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Yes" : "No"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" title="Reset password" onClick={() => setPwTarget(r)}><KeyRound className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Users" description="Create users & agents, assign extensions, reset credentials."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create user</Button>} />
      <div className="mb-4 max-w-sm"><Input placeholder="Search users…" value={list.search} onChange={(e) => list.setSearch(e.target.value)} /></div>
      <DataTable<U> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No users." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit user" : "Create user"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Username" value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label={editing ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select label="Role" options={ROLES} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <Select label="Extension" placeholder="None" value={form.extension} onChange={(e) => setForm({ ...form, extension: e.target.value })}
            options={exts.map((x) => ({ label: x.extensionNumber, value: x.extensionNumber }))} />
          <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="sm:col-span-2"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <Modal open={!!pwTarget} onClose={() => setPwTarget(null)} size="sm" title="Reset password"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPwTarget(null)}>Cancel</Button><Button variant="primary" disabled={newPw.length < 8} onClick={resetPw}>Reset</Button></div>}>
        <Input label="New password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} hint="At least 8 characters" />
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete user" description={del ? `Delete ${del.username}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
