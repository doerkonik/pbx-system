"use client";
/** Admin › Ring Groups — ring several extensions on one number. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface RingGroup {
  id: string; number: string; name: string; strategy: string; memberExtensions: string[];
  ringTimeSec: number; noAnswerDestType: string; noAnswerDestValue?: string | null;
  callerIdPrefix?: string | null; isActive: boolean;
}
const STRATEGIES = [
  { label: "Ring all", value: "ringall" },
  { label: "Hunt (sequential)", value: "hunt" },
  { label: "Memory hunt", value: "memoryhunt" },
];
const DEST_TYPES = [
  { label: "Hangup", value: "hangup" },
  { label: "Extension", value: "extension" },
  { label: "Queue", value: "queue" },
  { label: "Voicemail", value: "voicemail" },
  { label: "IVR menu", value: "ivr" },
  { label: "Misc destination", value: "misc_destination" },
];
const EMPTY = { number: "", name: "", strategy: "ringall", members: "", ringTimeSec: 20, noAnswerDestType: "hangup", noAnswerDestValue: "", callerIdPrefix: "" , isActive: true };

export default function RingGroupsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<RingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RingGroup | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<RingGroup | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<RingGroup[]>("/ring-groups")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: RingGroup) {
    setEditing(r);
    setForm({
      number: r.number, name: r.name, strategy: r.strategy, members: r.memberExtensions.join(", "),
      ringTimeSec: r.ringTimeSec, noAnswerDestType: r.noAnswerDestType, noAnswerDestValue: r.noAnswerDestValue ?? "",
      callerIdPrefix: r.callerIdPrefix ?? "", isActive: r.isActive,
    });
    setOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      const members = String(form.members).split(",").map((s: string) => s.trim()).filter(Boolean);
      const body: any = {
        number: form.number, name: form.name, strategy: form.strategy, memberExtensions: members,
        ringTimeSec: Number(form.ringTimeSec), noAnswerDestType: form.noAnswerDestType,
        noAnswerDestValue: form.noAnswerDestValue || undefined, callerIdPrefix: form.callerIdPrefix || undefined, isActive: form.isActive,
      };
      if (editing) await api.patch(`/ring-groups/${editing.id}`, body);
      else await api.post("/ring-groups", body);
      toast({ title: editing ? "Ring group updated" : "Ring group created", variant: "success" });
      setOpen(false); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/ring-groups/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<RingGroup>[] = [
    { key: "number", header: "Number", cell: (r) => <span className="font-medium">{r.number}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "strategy", header: "Strategy", cell: (r) => <Badge variant="neutral">{r.strategy}</Badge> },
    { key: "members", header: "Members", cell: (r) => r.memberExtensions.join(", ") || <span className="text-ink-subtle">—</span> },
    { key: "status", header: "Status", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Ring Groups" description="Ring several extensions from one number."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create group</Button>} />
      <DataTable<RingGroup> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No ring groups yet." />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit ring group" : "Create ring group"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Number" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Strategy" options={STRATEGIES} value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} />
          <Input label="Ring time (sec)" type="number" value={form.ringTimeSec} onChange={(e) => setForm({ ...form, ringTimeSec: e.target.value })} />
          <div className="sm:col-span-2"><Input label="Members (comma-separated extensions)" placeholder="1001, 1002, 1003" value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} /></div>
          <Select label="No-answer destination" options={DEST_TYPES} value={form.noAnswerDestType} onChange={(e) => setForm({ ...form, noAnswerDestType: e.target.value })} />
          <Input label="Destination value" disabled={form.noAnswerDestType === "hangup"} value={form.noAnswerDestValue} onChange={(e) => setForm({ ...form, noAnswerDestValue: e.target.value })} />
          <Input label="Caller-ID prefix (optional)" value={form.callerIdPrefix} onChange={(e) => setForm({ ...form, callerIdPrefix: e.target.value })} />
          <div className="flex items-end"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete ring group" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
