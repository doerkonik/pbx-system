"use client";
/** Admin › QA Forms — scorecards used to evaluate calls. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Toggle, Badge, Spinner,
  ConfirmDialog, useToast, type Column,
} from "@/components/ui";

interface QaQuestion { id?: string; section?: string | null; text: string; maxScore: number; weight: number; }
interface QaForm { id: string; name: string; description?: string | null; isActive: boolean; questions?: QaQuestion[]; }

const emptyQuestion = (): QaQuestion => ({ section: "", text: "", maxScore: 5, weight: 1 });
const EMPTY = { name: "", description: "", isActive: true, questions: [emptyQuestion()] as QaQuestion[] };

export default function QaFormsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<QaForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QaForm | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<QaForm | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<QaForm[]>("/qa/forms")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  function openCreate() { setEditing(null); setForm({ ...EMPTY, questions: [emptyQuestion()] }); setOpen(true); }
  async function openEdit(f: QaForm) {
    setEditing(f);
    try {
      const full = await api.get<QaForm>(`/qa/forms/${f.id}`);
      setForm({
        name: full.name, description: full.description ?? "", isActive: full.isActive,
        questions: (full.questions ?? []).map((q) => ({ section: q.section ?? "", text: q.text, maxScore: q.maxScore, weight: q.weight })),
      });
      setOpen(true);
    } catch { toast({ title: "Could not load form", variant: "error" }); }
  }

  const setQ = (i: number, patch: Partial<QaQuestion>) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) }));
  const addQ = () => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion()] }));
  const rmQ = (i: number) => setForm((f) => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) }));

  async function save() {
    setSaving(true);
    try {
      const questions = form.questions
        .filter((q) => q.text.trim())
        .map((q) => ({ section: q.section || undefined, text: q.text, maxScore: Number(q.maxScore) || 5, weight: Number(q.weight) || 1 }));
      const body: any = { name: form.name, description: form.description || undefined, isActive: form.isActive, questions };
      if (editing) await api.patch(`/qa/forms/${editing.id}`, body);
      else await api.post("/qa/forms", body);
      toast({ title: editing ? "Form updated" : "Form created", variant: "success" });
      setOpen(false); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }
  async function confirmDelete() { if (!del) return; await api.del(`/qa/forms/${del.id}`); setDel(null); await reload(); toast({ title: "Deleted", variant: "success" }); }

  const columns: Column<QaForm>[] = [
    { key: "name", header: "Name", cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: "description", header: "Description", cell: (r) => r.description || <span className="text-ink-subtle">—</span> },
    { key: "status", header: "Status", cell: (r) => <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
      </div>) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="QA Forms" description="Scorecards used to evaluate calls."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Create form</Button>} />
      <DataTable<QaForm> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No QA forms yet." />
      <Modal open={open} onClose={() => !saving && setOpen(false)} size="xl" title={editing ? "Edit form" : "Create form"}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{editing ? "Save" : "Create"}</Button></div>}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Questions</span>
              <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addQ}>Add question</Button>
            </div>
            <div className="flex flex-col gap-2">
              {form.questions.map((q, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-line p-2">
                  <div className="col-span-3"><Input label={i === 0 ? "Section" : undefined} placeholder="Section" value={q.section ?? ""} onChange={(e) => setQ(i, { section: e.target.value })} /></div>
                  <div className="col-span-5"><Input label={i === 0 ? "Question" : undefined} placeholder="Question text" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} /></div>
                  <div className="col-span-2"><Input label={i === 0 ? "Max" : undefined} type="number" value={q.maxScore} onChange={(e) => setQ(i, { maxScore: Number(e.target.value) })} /></div>
                  <div className="col-span-1"><Input label={i === 0 ? "Wt" : undefined} type="number" value={q.weight} onChange={(e) => setQ(i, { weight: Number(e.target.value) })} /></div>
                  <div className="col-span-1 flex justify-center pb-1">
                    <Button variant="ghost" size="icon" onClick={() => rmQ(i)} disabled={form.questions.length === 1}><X className="h-4 w-4 text-danger" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Toggle checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} label="Active" />
        </div>
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={confirmDelete} title="Delete form" description={del ? `Delete ${del.name}?` : ""} confirmLabel="Delete" destructive />
    </div>
  );
}
