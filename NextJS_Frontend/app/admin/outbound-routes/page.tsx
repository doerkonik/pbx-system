"use client";
/** Admin › Outbound routes — dial-pattern rules selecting a trunk. */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Modal, Button, Input, Toggle, Badge, Card, Spinner, ConfirmDialog, useToast, type Column } from "@/components/ui";

interface Route { id: string; name: string; pattern: string; prefix?: string | null; stripDigits: number; callerIdOverride?: string | null; priority: number; trunkIds: string[]; isActive: boolean; }
interface Trunk { id: string; name: string; }
const EMPTY = { name: "", pattern: "", prefix: "", stripDigits: 0, callerIdOverride: "", priority: 0, trunkIds: [] as string[], isActive: true };

export default function OutboundRoutesPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const list = useResourceList<Route>("/outbound-routes");
  const [trunks, setTrunks] = useState<Trunk[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Route | null>(null);
  const [testNum, setTestNum] = useState("");
  const [testRes, setTestRes] = useState<string>("");

  useEffect(() => { void api.get<PaginatedResult<Trunk>>("/trunks", { params: { limit: 200 } }).then((r) => setTrunks(r.data)).catch(() => undefined); }, []);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: Route) { setEditing(r); setForm({ ...EMPTY, ...r, prefix: r.prefix ?? "", callerIdOverride: r.callerIdOverride ?? "" }); setOpen(true); }

  async function save() {
    setSaving(true);
    try {
      const body = { name: form.name, pattern: form.pattern, prefix: form.prefix || undefined, stripDigits: Number(form.stripDigits), callerIdOverride: form.callerIdOverride || undefined, priority: Number(form.priority), trunkIds: form.trunkIds, isActive: form.isActive };
      if (editing) await api.patch(`/outbound-routes/${editing.id}`, body); else await api.post("/outbound-routes", body);
      toast({ title: editing ? "Route updated" : "Route created", variant: "success" });
      setOpen(false); await list.reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/outbound-routes/${del.id}`); setDel(null); await list.reload(); toast({ title: "Deleted", variant: "success" }); }
  async function runTest() {
    try { const r = await api.get<Route | null>("/outbound-routes/resolve", { params: { number: testNum } }); setTestRes(r ? `Matched: ${r.name}` : "No matching route"); }
    catch { setTestRes("No matching route"); }
  }

  const columns: Column<Route>[] = [
    { key: "priority", header: "#", width: "1%", cell: (r) => r.priority },
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "pattern", header: "Pattern", cell: (r) => <code className="text-xs">{r.pattern}</code> },
    { key: "trunkIds", header: "Trunks", cell: (r) => <Badge variant="neutral">{r.trunkIds.length}</Badge> },
    { key: "isActive", header: "Active", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Yes" : "No"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (<div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button></div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Outbound routes" description="Decide which trunk handles a dialed pattern."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create route</Button>} />
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Input label="Test a number" value={testNum} onChange={(e) => setTestNum(e.target.value)} placeholder="e.g. 917000000000" containerClassName="max-w-xs" />
        <Button variant="secondary" onClick={runTest}>Resolve</Button>
        {testRes && <span className="pb-2 text-sm text-ink-muted">{testRes}</span>}
      </Card>
      <DataTable<Route> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No routes." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="lg" title={editing ? "Edit route" : "Create route"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Pattern" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} placeholder="_9NXXXXXXXXX" />
          <Input label="Prefix" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
          <Input label="Strip digits" type="number" value={form.stripDigits} onChange={(e) => setForm({ ...form, stripDigits: e.target.value })} />
          <Input label="Caller ID override" value={form.callerIdOverride} onChange={(e) => setForm({ ...form, callerIdOverride: e.target.value })} />
          <Input label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-ink">Trunks (failover order)</label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-line p-3">
              {trunks.map((t) => {
                const on = form.trunkIds.includes(t.id);
                return <button type="button" key={t.id} onClick={() => setForm({ ...form, trunkIds: on ? form.trunkIds.filter((x: string) => x !== t.id) : [...form.trunkIds, t.id] })}
                  className={`rounded-full border px-3 py-1 text-sm ${on ? "border-accent bg-accent/10 text-accent" : "border-line text-ink-muted"}`}>{t.name}</button>;
              })}
              {trunks.length === 0 && <span className="text-sm text-ink-muted">No trunks yet.</span>}
            </div>
          </div>
          <div className="sm:col-span-2"><Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" /></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete route" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
