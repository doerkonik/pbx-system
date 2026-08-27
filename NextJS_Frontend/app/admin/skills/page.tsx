"use client";
/** Admin › Skills — skill-based routing: catalogue, agent proficiencies, queue rules. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Button, Input, Select, Badge, Spinner, useToast } from "@/components/ui";

interface Skill { id: string; name: string; description?: string | null; }
interface AgentSkill { id: string; extension: string; skillId: string; level: number; skill?: { name: string }; }
interface QueueSkill { id: string; queueName: string; skillId: string; minLevel: number; skill?: { name: string }; }
const LEVELS = [1, 2, 3, 4, 5].map((n) => ({ label: `L${n}`, value: String(n) }));

export default function SkillsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([]);
  const [queueSkills, setQueueSkills] = useState<QueueSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const [nsName, setNsName] = useState(""); const [nsDesc, setNsDesc] = useState("");
  const [asExt, setAsExt] = useState(""); const [asSkill, setAsSkill] = useState(""); const [asLevel, setAsLevel] = useState("3");
  const [qsQueue, setQsQueue] = useState(""); const [qsSkill, setQsSkill] = useState(""); const [qsMin, setQsMin] = useState("1");
  const [applyQueue, setApplyQueue] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const [s, a, q] = await Promise.allSettled([
      api.get<Skill[]>("/skills"), api.get<AgentSkill[]>("/agent-skills"), api.get<QueueSkill[]>("/queue-skills"),
    ]);
    if (s.status === "fulfilled") setSkills(s.value);
    if (a.status === "fulfilled") setAgentSkills(a.value);
    if (q.status === "fulfilled") setQueueSkills(q.value);
    setLoading(false);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const skillOpts = [{ label: "Select skill…", value: "" }, ...skills.map((s) => ({ label: s.name, value: s.id }))];
  const err = (e: unknown) => toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });

  async function addSkill() { try { await api.post("/skills", { name: nsName, description: nsDesc || undefined }); setNsName(""); setNsDesc(""); await reload(); } catch (e) { err(e); } }
  async function addAgentSkill() { try { await api.post("/agent-skills", { extension: asExt, skillId: asSkill, level: Number(asLevel) }); setAsExt(""); setAsSkill(""); await reload(); } catch (e) { err(e); } }
  async function addQueueSkill() { try { await api.post("/queue-skills", { queueName: qsQueue, skillId: qsSkill, minLevel: Number(qsMin) }); setQsQueue(""); setQsSkill(""); await reload(); } catch (e) { err(e); } }
  async function apply() {
    try { const r = await api.post<{ added: number; updated: number; members: unknown[] }>(`/queue-skills/${encodeURIComponent(applyQueue)}/apply`); toast({ title: `Applied: +${r.added} added, ${r.updated} re-penalised, ${r.members.length} qualified`, variant: "success" }); }
    catch (e) { err(e); }
  }
  async function delSkill(id: string) { await api.del(`/skills/${id}`); await reload(); }
  async function delAgentSkill(id: string) { await api.del(`/agent-skills/${id}`); await reload(); }
  async function delQueueSkill(id: string) { await api.del(`/queue-skills/${id}`); await reload(); }

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  const th = "py-2 pr-3 text-left text-sm font-bold text-ink-muted";
  const td = "py-2 pr-3";
  return (
    <div>
      <PageHeader title="Skills" description="Route calls to agents by skill and proficiency." />
      <div className="flex flex-col gap-6">
        {/* Catalogue */}
        <Card>
          <h3 className="mb-3 text-base font-semibold text-ink">Skill catalogue</h3>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-48"><Input label="Skill name" value={nsName} onChange={(e) => setNsName(e.target.value)} /></div>
            <div className="flex-1"><Input label="Description" value={nsDesc} onChange={(e) => setNsDesc(e.target.value)} /></div>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} disabled={!nsName} onClick={addSkill}>Add</Button>
          </div>
          <table className="w-full text-sm"><thead><tr className="border-b border-line"><th className={th}>Name</th><th className={th}>Description</th><th className={th}></th></tr></thead>
            <tbody>{skills.map((s) => (<tr key={s.id} className="border-b border-line/60"><td className={`${td} font-medium text-ink`}>{s.name}</td><td className={td}>{s.description || <span className="text-ink-subtle">—</span>}</td><td className={`${td} text-right`}><Button variant="ghost" size="icon" onClick={() => delSkill(s.id)}><Trash2 className="h-4 w-4 text-danger" /></Button></td></tr>))}
              {skills.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-ink-subtle">No skills yet.</td></tr>}</tbody></table>
        </Card>

        {/* Agent proficiencies */}
        <Card>
          <h3 className="mb-3 text-base font-semibold text-ink">Agent proficiencies</h3>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-40"><Input label="Extension" value={asExt} onChange={(e) => setAsExt(e.target.value)} /></div>
            <div className="w-56"><Select label="Skill" options={skillOpts} value={asSkill} onChange={(e) => setAsSkill(e.target.value)} /></div>
            <div className="w-24"><Select label="Level" options={LEVELS} value={asLevel} onChange={(e) => setAsLevel(e.target.value)} /></div>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} disabled={!asExt || !asSkill} onClick={addAgentSkill}>Assign</Button>
          </div>
          <table className="w-full text-sm"><thead><tr className="border-b border-line"><th className={th}>Extension</th><th className={th}>Skill</th><th className={th}>Level</th><th className={th}></th></tr></thead>
            <tbody>{agentSkills.map((a) => (<tr key={a.id} className="border-b border-line/60"><td className={`${td} font-medium text-ink`}>{a.extension}</td><td className={td}>{a.skill?.name}</td><td className={td}><Badge variant="accent">L{a.level}</Badge></td><td className={`${td} text-right`}><Button variant="ghost" size="icon" onClick={() => delAgentSkill(a.id)}><Trash2 className="h-4 w-4 text-danger" /></Button></td></tr>))}
              {agentSkills.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-ink-subtle">No assignments yet.</td></tr>}</tbody></table>
        </Card>

        {/* Queue requirements */}
        <Card>
          <h3 className="mb-3 text-base font-semibold text-ink">Queue requirements</h3>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="w-40"><Input label="Queue" value={qsQueue} onChange={(e) => setQsQueue(e.target.value)} /></div>
            <div className="w-56"><Select label="Skill" options={skillOpts} value={qsSkill} onChange={(e) => setQsSkill(e.target.value)} /></div>
            <div className="w-24"><Select label="Min level" options={LEVELS} value={qsMin} onChange={(e) => setQsMin(e.target.value)} /></div>
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} disabled={!qsQueue || !qsSkill} onClick={addQueueSkill}>Require</Button>
          </div>
          <table className="w-full text-sm"><thead><tr className="border-b border-line"><th className={th}>Queue</th><th className={th}>Skill</th><th className={th}>Min</th><th className={th}></th></tr></thead>
            <tbody>{queueSkills.map((q) => (<tr key={q.id} className="border-b border-line/60"><td className={`${td} font-medium text-ink`}>{q.queueName}</td><td className={td}>{q.skill?.name}</td><td className={td}><Badge variant="neutral">L{q.minLevel}+</Badge></td><td className={`${td} text-right`}><Button variant="ghost" size="icon" onClick={() => delQueueSkill(q.id)}><Trash2 className="h-4 w-4 text-danger" /></Button></td></tr>))}
              {queueSkills.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-ink-subtle">No requirements yet.</td></tr>}</tbody></table>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <div className="w-48"><Input label="Apply routing to queue" value={applyQueue} onChange={(e) => setApplyQueue(e.target.value)} /></div>
            <Button variant="secondary" leftIcon={<Zap className="h-4 w-4" />} disabled={!applyQueue} onClick={apply}>Apply to live queue</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
