"use client";
/** Admin/Supervisor › Campaigns — preview outbound dialer. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Play, Pause, Upload, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Textarea, Badge, Spinner,
  ConfirmDialog, useToast, type Column, type BadgeVariant,
} from "@/components/ui";

interface Campaign { id: string; name: string; mode: string; callerId?: string | null; status: string; }
const MODES = [
  { label: "Preview", value: "preview" },
  { label: "Progressive", value: "progressive" },
  { label: "Predictive", value: "predictive" },
];
const STATUS: Record<string, BadgeVariant> = { draft: "neutral", active: "success", paused: "warn", done: "info" };
const EMPTY = { name: "", mode: "preview", callerId: "" };

export default function CampaignsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Campaign | null>(null);
  const [contactsFor, setContactsFor] = useState<Campaign | null>(null);
  const [contactsText, setContactsText] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<Campaign[]>("/campaigns")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function create() {
    setSaving(true);
    try {
      await api.post("/campaigns", { name: form.name, mode: form.mode, callerId: form.callerId || undefined });
      toast({ title: "Campaign created", variant: "success" });
      setOpen(false); setForm(EMPTY); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function setStatus(c: Campaign, status: string) {
    try { await api.post(`/campaigns/${c.id}/status`, { status }); await reload(); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }
  async function uploadContacts() {
    if (!contactsFor) return;
    setSaving(true);
    try {
      const contacts = contactsText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
        const [phone, name] = line.split(",").map((s) => s.trim());
        return { phone, name: name || undefined };
      });
      const r = await api.post<{ added: number }>(`/campaigns/${contactsFor.id}/contacts`, { contacts });
      toast({ title: `Added ${r.added} contacts`, variant: "success" });
      setContactsFor(null); setContactsText("");
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/campaigns/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<Campaign>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "mode", header: "Mode", cell: (r) => <Badge variant="neutral">{r.mode}</Badge> },
    { key: "status", header: "Status", cell: (r) => <Badge variant={STATUS[r.status] ?? "neutral"}>{r.status}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        {r.status === "active"
          ? <Button variant="ghost" size="icon" title="Pause" onClick={() => setStatus(r, "paused")}><Pause className="h-4 w-4 text-warn" /></Button>
          : <Button variant="ghost" size="icon" title="Start" onClick={() => setStatus(r, "active")}><Play className="h-4 w-4 text-success" /></Button>}
        <Button variant="ghost" size="icon" title="Add contacts" onClick={() => { setContactsFor(r); setContactsText(""); }}><Upload className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" title="Delete" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Campaigns" description="Preview-mode outbound dialer."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(EMPTY); setOpen(true); }}>New campaign</Button>} />
      <DataTable<Campaign> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No campaigns yet." />

      <Modal open={open} onClose={() => !saving && setOpen(false)} size="md" title="New campaign"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={create}>Create</Button></div>}>
        <div className="grid grid-cols-1 gap-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Select label="Mode" options={MODES} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} />
          <Input label="Caller ID (optional)" value={form.callerId} onChange={(e) => setForm({ ...form, callerId: e.target.value })} />
        </div>
      </Modal>

      <Modal open={!!contactsFor} onClose={() => !saving && setContactsFor(null)} size="md" title={`Add contacts${contactsFor ? ` · ${contactsFor.name}` : ""}`}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setContactsFor(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={uploadContacts}>Add</Button></div>}>
        <Textarea label="One per line: phone,name" rows={8} placeholder={"017xxxxxxxx, John Doe\n018xxxxxxxx, Jane"} value={contactsText} onChange={(e) => setContactsText(e.target.value)} />
      </Modal>

      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete campaign" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
