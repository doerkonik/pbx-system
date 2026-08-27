"use client";
/** Admin › Conference — ConfBridge rooms + live participant management. */
import { useState } from "react";
import { Plus, Trash2, Users, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Toggle, Badge, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

interface Conf { id: string; roomNumber: string; name: string; recordingEnabled: boolean; mohClass: string; isActive: boolean; }
const EMPTY = { roomNumber: "", name: "", pin: "", adminPin: "", recordingEnabled: true, mohClass: "default", isActive: true };

export default function ConferencePage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Conf>("/conference");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Conf | null>(null);
  const [partsFor, setPartsFor] = useState<Conf | null>(null);
  const [parts, setParts] = useState<Record<string, string>>({});
  const [addExt, setAddExt] = useState("");

  async function save() {
    setSaving(true);
    try {
      await api.post("/conference", { roomNumber: form.roomNumber, name: form.name, pin: form.pin || undefined, adminPin: form.adminPin || undefined, recordingEnabled: form.recordingEnabled, mohClass: form.mohClass, isActive: form.isActive });
      toast({ title: "Conference created", variant: "success" });
      setOpen(false); setForm(EMPTY); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/conference/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }
  async function openParts(c: Conf) { setPartsFor(c); try { const p = await api.get<Record<string, string>>(`/conference/${c.id}/participants`); setParts(p || {}); } catch { setParts({}); } }
  async function addParticipant() {
    if (!partsFor || !addExt) return;
    try { await api.post(`/conference/${partsFor.id}/participants`, { extension: addExt }); toast({ title: `Dialing ${addExt}`, variant: "success" }); setAddExt(""); await openParts(partsFor); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }
  async function kick(channelId: string) { if (!partsFor) return; await api.del(`/conference/${partsFor.id}/participants/${encodeURIComponent(channelId)}`); await openParts(partsFor); }

  const columns: Column<Conf>[] = [
    { key: "roomNumber", header: "Room", cell: (r) => <span className="font-medium">{r.roomNumber}</span> },
    { key: "name", header: "Name", cell: (r) => r.name },
    { key: "recordingEnabled", header: "Recording", cell: (r) => <Badge variant={r.recordingEnabled ? "success" : "neutral"}>{r.recordingEnabled ? "On" : "Off"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" title="Participants" onClick={() => openParts(r)}><Users className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Conferences" description="ConfBridge rooms and live participants."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(EMPTY); setOpen(true); }}>Create room</Button>} />
      <DataTable<Conf> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No conference rooms." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} title="Create conference"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>Create</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Room number" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} />
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="PIN" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} />
          <Input label="Admin PIN" value={form.adminPin} onChange={(e) => setForm({ ...form, adminPin: e.target.value })} />
          <Input label="MoH class" value={form.mohClass} onChange={(e) => setForm({ ...form, mohClass: e.target.value })} />
          <div className="flex items-end"><Toggle checked={form.recordingEnabled} onCheckedChange={(v) => setForm({ ...form, recordingEnabled: v })} label="Record" /></div>
        </div>
      </Modal>
      <Modal open={!!partsFor} onClose={() => setPartsFor(null)} title={`Participants · ${partsFor?.roomNumber ?? ""}`}>
        <div className="mb-4 flex gap-2">
          <Input value={addExt} onChange={(e) => setAddExt(e.target.value)} placeholder="Extension to add" />
          <Button variant="primary" leftIcon={<UserPlus className="h-4 w-4" />} onClick={addParticipant}>Add</Button>
        </div>
        {Object.keys(parts).length === 0 ? <p className="text-sm text-ink-muted">No participants.</p> : (
          <div className="divide-y divide-line">
            {Object.entries(parts).map(([channelId, ext]) => (
              <div key={channelId} className="flex items-center justify-between py-2">
                <span className="text-sm text-ink">{ext}</span>
                <Button variant="ghost" size="sm" onClick={() => kick(channelId)}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete conference" description={del ? `Delete room ${del.roomNumber}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
