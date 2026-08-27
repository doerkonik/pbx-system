"use client";
/** Admin › IVR — DTMF menus executed live over ARI. */
import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

type DestType = "extension" | "queue" | "ivr" | "misc_destination" | "voicemail" | "hangup";
interface Entry { digit: string; destType: DestType; destValue?: string | null; label?: string | null; }
interface Menu { id: string; name: string; greetingSound: string; digitTimeoutSec: number; maxRetries: number; invalidDestType: DestType; invalidDestValue?: string | null; isActive: boolean; entries: Entry[]; }
const DEST = [
  { label: "Extension", value: "extension" }, { label: "Queue", value: "queue" }, { label: "IVR", value: "ivr" },
  { label: "Misc destination", value: "misc_destination" }, { label: "Voicemail", value: "voicemail" }, { label: "Hangup", value: "hangup" },
];
const EMPTY: any = { name: "", greetingSound: "", digitTimeoutSec: 5, maxRetries: 3, invalidDestType: "hangup", invalidDestValue: "", isActive: true, entries: [] };

export default function IvrPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Menu>("/ivr");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Menu | null>(null);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  async function openEdit(m: Menu) {
    setEditing(m);
    try { const full = await api.get<Menu>(`/ivr/${m.id}`); setForm({ ...EMPTY, ...full, invalidDestValue: full.invalidDestValue ?? "", entries: full.entries ?? [] }); }
    catch { setForm({ ...EMPTY, ...m }); }
    setOpen(true);
  }
  function setEntry(i: number, patch: Partial<Entry>) { setForm((f: any) => ({ ...f, entries: f.entries.map((e: Entry, idx: number) => idx === i ? { ...e, ...patch } : e) })); }
  function addEntry() { setForm((f: any) => ({ ...f, entries: [...f.entries, { digit: "", destType: "extension", destValue: "", label: "" }] })); }
  function delEntry(i: number) { setForm((f: any) => ({ ...f, entries: f.entries.filter((_: Entry, idx: number) => idx !== i) })); }

  async function save() {
    const digits = form.entries.map((e: Entry) => e.digit);
    if (new Set(digits).size !== digits.length) { toast({ title: "Duplicate digits", variant: "error" }); return; }
    for (const e of form.entries) if (e.destType !== "hangup" && !e.destValue) { toast({ title: `Entry ${e.digit} needs a destination`, variant: "error" }); return; }
    setSaving(true);
    try {
      const body = { name: form.name, greetingSound: form.greetingSound, digitTimeoutSec: Number(form.digitTimeoutSec), maxRetries: Number(form.maxRetries), invalidDestType: form.invalidDestType, invalidDestValue: form.invalidDestType === "hangup" ? undefined : form.invalidDestValue, isActive: form.isActive, entries: form.entries };
      if (editing) await api.patch(`/ivr/${editing.id}`, body); else await api.post("/ivr", body);
      toast({ title: editing ? "IVR updated" : "IVR created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/ivr/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Menu>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "entries", header: "Options", cell: (r) => <Badge variant="neutral">{r.entries?.length ?? 0}</Badge> },
    { key: "isActive", header: "Active", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Yes" : "No"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (<div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button></div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="IVR menus" description="DTMF voice menus routed live via ARI."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create IVR</Button>} />
      <DataTable<Menu> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No IVR menus." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="xl" title={editing ? "Edit IVR" : "Create IVR"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Greeting sound" value={form.greetingSound} onChange={(e) => setForm({ ...form, greetingSound: e.target.value })} placeholder="custom/welcome" />
            <Input label="Digit timeout (s)" type="number" value={form.digitTimeoutSec} onChange={(e) => setForm({ ...form, digitTimeoutSec: e.target.value })} />
            <Input label="Max retries" type="number" value={form.maxRetries} onChange={(e) => setForm({ ...form, maxRetries: e.target.value })} />
            <Select label="Invalid → type" options={DEST} value={form.invalidDestType} onChange={(e) => setForm({ ...form, invalidDestType: e.target.value })} />
            {form.invalidDestType !== "hangup" && <Input label="Invalid → value" value={form.invalidDestValue} onChange={(e) => setForm({ ...form, invalidDestValue: e.target.value })} />}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-ink">DTMF options</label>
              <Button type="button" variant="secondary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={addEntry}>Add option</Button>
            </div>
            <div className="space-y-2">
              {form.entries.map((e: Entry, i: number) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-line p-2">
                  <Input containerClassName="col-span-2" placeholder="Digit" value={e.digit} onChange={(ev) => setEntry(i, { digit: ev.target.value })} />
                  <Select containerClassName="col-span-3" options={DEST} value={e.destType} onChange={(ev) => setEntry(i, { destType: ev.target.value as DestType })} />
                  <Input containerClassName="col-span-3" placeholder="Destination" value={e.destValue ?? ""} onChange={(ev) => setEntry(i, { destValue: ev.target.value })} disabled={e.destType === "hangup"} />
                  <Input containerClassName="col-span-3" placeholder="Label" value={e.label ?? ""} onChange={(ev) => setEntry(i, { label: ev.target.value })} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => delEntry(i)}><X className="h-4 w-4 text-danger" /></Button>
                </div>
              ))}
              {form.entries.length === 0 && <p className="text-sm text-ink-muted">No options yet.</p>}
            </div>
          </div>
          <Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete IVR" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
