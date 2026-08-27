"use client";
/** Admin/Supervisor › QA Evaluations — assign, score, and complete call reviews. */
import { useCallback, useEffect, useState } from "react";
import { Plus, ClipboardCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader, DataTable, Modal, Button, Input, Select, Textarea, Badge, Spinner,
  useToast, type Column, type BadgeVariant,
} from "@/components/ui";

interface Evaluation {
  id: string; formId: string; uniqueid: string; agentExtension?: string | null;
  evaluatorId: string; status: string; totalScore: number; maxScore: number; scorePct: string;
}
interface Question { id: string; section?: string | null; text: string; maxScore: number; weight: number; }
interface EvalDetail extends Evaluation {
  summary?: string | null;
  scores: { questionId: string; score: number; comment?: string | null }[];
  form: { questions: Question[] };
}
const STATUS: Record<string, BadgeVariant> = {
  assigned: "neutral", in_progress: "warn", completed: "success", disputed: "danger",
};
const EMPTY = { formId: "", uniqueid: "", agentExtension: "", evaluatorId: "" };

export default function QaEvaluationsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [forms, setForms] = useState<{ label: string; value: string }[]>([]);
  const [users, setUsers] = useState<{ label: string; value: string }[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<EvalDetail | null>(null);
  const [scoreMap, setScoreMap] = useState<Record<string, { score: number; comment: string }>>({});
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<Evaluation[]>("/qa/evaluations")); setError(null); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    void api.get<{ id: string; name: string }[]>("/qa/forms").then((f) => setForms(f.map((x) => ({ label: x.name, value: x.id })))).catch(() => undefined);
    void api.get<{ data: { id: string; username: string; fullName?: string | null }[] }>("/users", { params: { limit: 200 } })
      .then((r) => setUsers(r.data.map((u) => ({ label: u.fullName || u.username, value: u.id })))).catch(() => undefined);
  }, []);

  async function createEval() {
    setSaving(true);
    try {
      await api.post("/qa/evaluations", {
        formId: form.formId, uniqueid: form.uniqueid,
        agentExtension: form.agentExtension || undefined, evaluatorId: form.evaluatorId,
      });
      toast({ title: "Evaluation assigned", variant: "success" });
      setCreateOpen(false); setForm(EMPTY); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setSaving(false); }
  }

  async function openScore(id: string) {
    try {
      const d = await api.get<EvalDetail>(`/qa/evaluations/${id}`);
      const map: Record<string, { score: number; comment: string }> = {};
      for (const q of d.form.questions) {
        const existing = d.scores.find((s) => s.questionId === q.id);
        map[q.id] = { score: existing?.score ?? 0, comment: existing?.comment ?? "" };
      }
      setScoreMap(map); setSummary(d.summary ?? ""); setDetail(d);
    } catch { toast({ title: "Could not load evaluation", variant: "error" }); }
  }

  async function submitScores(complete: boolean) {
    if (!detail) return;
    setBusy(true);
    try {
      const scores = Object.entries(scoreMap).map(([questionId, v]) => ({ questionId, score: Number(v.score) || 0, comment: v.comment || undefined }));
      await api.post(`/qa/evaluations/${detail.id}/scores`, { scores, summary: summary || undefined });
      if (complete) await api.post(`/qa/evaluations/${detail.id}/complete`);
      toast({ title: complete ? "Evaluation completed" : "Scores saved", variant: "success" });
      setDetail(null); await reload();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setBusy(false); }
  }

  const columns: Column<Evaluation>[] = [
    { key: "uniqueid", header: "Call", cell: (r) => <span className="font-mono text-xs">{r.uniqueid}</span> },
    { key: "agent", header: "Agent", cell: (r) => r.agentExtension || <span className="text-ink-subtle">—</span> },
    { key: "status", header: "Status", cell: (r) => <Badge variant={STATUS[r.status] ?? "neutral"}>{r.status.replace("_", " ")}</Badge> },
    { key: "score", header: "Score", cell: (r) => r.status === "assigned" ? <span className="text-ink-subtle">—</span> : <span className="font-medium">{Number(r.scorePct).toFixed(0)}%</span> },
    { key: "actions", header: "", align: "right", cell: (r) => (
      <Button variant="secondary" size="sm" leftIcon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => openScore(r.id)}>Score</Button>
    ) },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="QA Evaluations" description="Assign, score and complete call reviews."
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>Assign evaluation</Button>} />
      <DataTable<Evaluation> columns={columns} data={rows} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} emptyMessage="No evaluations yet." />

      {/* Assign */}
      <Modal open={createOpen} onClose={() => !saving && setCreateOpen(false)} size="md" title="Assign evaluation"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={createEval}>Assign</Button></div>}>
        <div className="grid grid-cols-1 gap-4">
          <Select label="Scorecard" options={[{ label: "Select a form…", value: "" }, ...forms]} value={form.formId} onChange={(e) => setForm({ ...form, formId: e.target.value })} />
          <Input label="Call unique-id" value={form.uniqueid} onChange={(e) => setForm({ ...form, uniqueid: e.target.value })} />
          <Input label="Agent extension (optional)" value={form.agentExtension} onChange={(e) => setForm({ ...form, agentExtension: e.target.value })} />
          <Select label="Evaluator" options={[{ label: "Select a user…", value: "" }, ...users]} value={form.evaluatorId} onChange={(e) => setForm({ ...form, evaluatorId: e.target.value })} />
        </div>
      </Modal>

      {/* Score */}
      <Modal open={!!detail} onClose={() => !busy && setDetail(null)} size="xl" title="Score evaluation"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>
            <Button variant="secondary" loading={busy} onClick={() => submitScores(false)}>Save draft</Button>
            <Button variant="primary" loading={busy} onClick={() => submitScores(true)}>Complete</Button>
          </div>}>
        {detail && (
          <div className="flex flex-col gap-3">
            {detail.form.questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-line p-3">
                {q.section && <p className="mb-1 text-[11px] font-semibold text-ink-subtle">{q.section}</p>}
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">{q.text}</p>
                  <div className="flex shrink-0 items-center gap-1 text-sm">
                    <Input type="number" className="w-16" value={scoreMap[q.id]?.score ?? 0}
                      onChange={(e) => setScoreMap((m) => ({ ...m, [q.id]: { ...m[q.id], score: Number(e.target.value) } }))} />
                    <span className="text-ink-subtle">/ {q.maxScore}</span>
                  </div>
                </div>
                <Input className="mt-2" placeholder="Comment (optional)" value={scoreMap[q.id]?.comment ?? ""}
                  onChange={(e) => setScoreMap((m) => ({ ...m, [q.id]: { ...m[q.id], comment: e.target.value } }))} />
              </div>
            ))}
            <Textarea label="Overall summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          </div>
        )}
      </Modal>
    </div>
  );
}
