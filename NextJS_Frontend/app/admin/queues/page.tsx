"use client";
/** Admin › Queues — ACD queues with live snapshot + member management. */
import { useState } from "react";
import { Plus, Trash2, Users, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Select, Toggle, Badge, StatCard, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

interface Queue { id: string; name: string; displayName?: string | null; strategy: string; mohClass: string; timeout: number; wrapupTime: number; maxWait?: number | null; recordingEnabled: boolean; isActive: boolean; }
interface Member { interface: string; membername?: string; penalty?: number; paused?: number; }
const STRAT = ["ringall", "leastrecent", "fewestcalls", "random", "rrmemory", "linear", "wrandom"].map((s) => ({ label: s, value: s }));
const EMPTY: any = { name: "", displayName: "", strategy: "rrmemory", mohClass: "default", timeout: 15, wrapupTime: 0, maxlen: 0, ringinuse: true, maxWait: 0, recordingEnabled: false };

export default function QueuesPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Queue>("/queues");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Queue | null>(null);
  const [memFor, setMemFor] = useState<Queue | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [live, setLive] = useState<any>(null);
  const [addExt, setAddExt] = useState("");

  async function save() {
    setSaving(true);
    try {
      await api.post("/queues", { name: form.name, displayName: form.displayName || undefined, strategy: form.strategy, mohClass: form.mohClass, timeout: Number(form.timeout), wrapupTime: Number(form.wrapupTime), maxlen: Number(form.maxlen) || undefined, ringinuse: form.ringinuse, maxWait: Number(form.maxWait) || undefined, recordingEnabled: form.recordingEnabled });
      toast({ title: "Queue created", variant: "success" });
      setOpen(false); setForm(EMPTY); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/queues/${del.name}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }
  async function openMembers(q: Queue) {
    setMemFor(q);
    const [m, l] = await Promise.allSettled([api.get<Member[]>(`/queues/${q.name}/members`), api.get<any>(`/queues/${q.name}/live`)]);
    setMembers(m.status === "fulfilled" ? m.value : []);
    setLive(l.status === "fulfilled" ? l.value : null);
  }
  async function addMember() {
    if (!memFor || !addExt) return;
    try { await api.post(`/queues/${memFor.name}/members`, { extension: addExt }); toast({ title: "Member added", variant: "success" }); setAddExt(""); await openMembers(memFor); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }
  async function removeMember(ext: string) { if (!memFor) return; await api.del(`/queues/${memFor.name}/members/${ext}`); await openMembers(memFor); }

  const columns: Column<Queue>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "strategy", header: "Strategy", cell: (r) => <Badge variant="neutral">{r.strategy}</Badge> },
    { key: "timeout", header: "Timeout", cell: (r) => `${r.timeout}s` },
    { key: "recordingEnabled", header: "Recording", cell: (r) => <Badge variant={r.recordingEnabled ? "success" : "neutral"}>{r.recordingEnabled ? "On" : "Off"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (<div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Members" onClick={() => openMembers(r)}><Users className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button></div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Queues" description="Distribute incoming calls to agent groups."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(EMPTY); setOpen(true); }}>Create queue</Button>} />
      <DataTable<Queue> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No queues." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title="Create queue"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Create</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          <Select label="Strategy" options={STRAT} value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} />
          <Input label="MoH class" value={form.mohClass} onChange={(e) => setForm({ ...form, mohClass: e.target.value })} />
          <Input label="Ring timeout (s)" type="number" value={form.timeout} onChange={(e) => setForm({ ...form, timeout: e.target.value })} />
          <Input label="Wrapup (s)" type="number" value={form.wrapupTime} onChange={(e) => setForm({ ...form, wrapupTime: e.target.value })} />
          <Input label="Max callers (0=∞)" type="number" value={form.maxlen} onChange={(e) => setForm({ ...form, maxlen: e.target.value })} />
          <Input label="Max wait (s)" type="number" value={form.maxWait} onChange={(e) => setForm({ ...form, maxWait: e.target.value })} />
          <Toggle checked={form.ringinuse} onCheckedChange={(v) => setForm({ ...form, ringinuse: v })} label="Ring in-use" />
          <Toggle checked={form.recordingEnabled} onCheckedChange={(v) => setForm({ ...form, recordingEnabled: v })} label="Record" />
        </div>
      </Modal>
      <Modal open={!!memFor} onClose={() => setMemFor(null)} size="lg" title={`Members · ${memFor?.name ?? ""}`}>
        {live && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Waiting" value={live.calls ?? 0} highlight />
            <StatCard label="Longest wait" value={`${live.longestWait ?? 0}s`} />
            <StatCard label="Available" value={`${live.membersAvailable ?? 0}/${live.membersTotal ?? 0}`} />
          </div>
        )}
        <div className="mb-4 flex gap-2">
          <Input value={addExt} onChange={(e) => setAddExt(e.target.value)} placeholder="Extension to add" />
          <Button variant="primary" leftIcon={<UserPlus className="h-4 w-4" />} onClick={addMember}>Add</Button>
        </div>
        {members.length === 0 ? <p className="text-sm text-ink-muted">No members.</p> : (
          <div className="divide-y divide-line">
            {members.map((m) => {
              const ext = m.interface.replace("PJSIP/", "");
              return (
                <div key={m.interface} className="flex items-center justify-between py-2">
                  <span className="text-sm text-ink">{m.membername || ext} {m.paused ? <Badge variant="warn">paused</Badge> : null}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeMember(ext)}>Remove</Button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete queue" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
