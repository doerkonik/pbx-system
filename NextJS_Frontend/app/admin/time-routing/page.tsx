"use client";
/** Admin › Time Routing — business hours, time conditions and holidays. */
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Modal, Button, Input, Select, Toggle, Badge, Spinner, useToast } from "@/components/ui";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WD_OPTS = WD.map((d, i) => ({ label: d, value: String(i) }));
const DEST_TYPES = [
  { label: "Hangup", value: "hangup" }, { label: "Extension", value: "extension" },
  { label: "Queue", value: "queue" }, { label: "IVR menu", value: "ivr" },
  { label: "Voicemail", value: "voicemail" }, { label: "Misc destination", value: "misc_destination" },
  { label: "Conference", value: "conference" }, { label: "Time condition", value: "time_condition" },
];

interface Range { weekdayStart?: number | null; weekdayEnd?: number | null; timeStart?: string | null; timeEnd?: string | null; }
interface TimeGroup { id: string; name: string; ranges: Range[]; }
interface TimeCondition { id: string; name: string; timeGroupId: string; matchDestType: string; matchDestValue?: string | null; noMatchDestType: string; noMatchDestValue?: string | null; }
interface Holiday { id: string; name: string; date: string; recurring: boolean; destType: string; destValue?: string | null; }

export default function TimeRoutingPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [groups, setGroups] = useState<TimeGroup[]>([]);
  const [conditions, setConditions] = useState<TimeCondition[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [gOpen, setGOpen] = useState(false);
  const [gForm, setGForm] = useState<{ name: string; ranges: Range[] }>({ name: "", ranges: [{ weekdayStart: 1, weekdayEnd: 5, timeStart: "09:00", timeEnd: "17:00" }] });
  const [cOpen, setCOpen] = useState(false);
  const [cForm, setCForm] = useState<any>({ name: "", timeGroupId: "", matchDestType: "extension", matchDestValue: "", noMatchDestType: "hangup", noMatchDestValue: "" });
  const [hOpen, setHOpen] = useState(false);
  const [hForm, setHForm] = useState<any>({ name: "", date: "", recurring: false, destType: "hangup", destValue: "" });

  const reload = useCallback(async () => {
    setLoading(true);
    const [g, c, h] = await Promise.allSettled([
      api.get<TimeGroup[]>("/time-groups"), api.get<TimeCondition[]>("/time-conditions"), api.get<Holiday[]>("/holidays"),
    ]);
    if (g.status === "fulfilled") setGroups(g.value);
    if (c.status === "fulfilled") setConditions(c.value);
    if (h.status === "fulfilled") setHolidays(h.value);
    setLoading(false);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const err = (e: unknown) => toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
  const groupOpts = [{ label: "Select time group…", value: "" }, ...groups.map((g) => ({ label: g.name, value: g.id }))];

  const setRange = (i: number, patch: Partial<Range>) => setGForm((f) => ({ ...f, ranges: f.ranges.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const addRange = () => setGForm((f) => ({ ...f, ranges: [...f.ranges, { weekdayStart: 1, weekdayEnd: 5, timeStart: "09:00", timeEnd: "17:00" }] }));
  const rmRange = (i: number) => setGForm((f) => ({ ...f, ranges: f.ranges.filter((_, idx) => idx !== i) }));

  async function saveGroup() {
    setSaving(true);
    try {
      await api.post("/time-groups", {
        name: gForm.name,
        ranges: gForm.ranges.map((r) => ({
          weekdayStart: r.weekdayStart ?? undefined, weekdayEnd: r.weekdayEnd ?? undefined,
          timeStart: r.timeStart || undefined, timeEnd: r.timeEnd || undefined,
        })),
      });
      toast({ title: "Time group created", variant: "success" });
      setGOpen(false); setGForm({ name: "", ranges: [{ weekdayStart: 1, weekdayEnd: 5, timeStart: "09:00", timeEnd: "17:00" }] }); await reload();
    } catch (e) { err(e); } finally { setSaving(false); }
  }
  async function saveCondition() {
    setSaving(true);
    try {
      await api.post("/time-conditions", {
        name: cForm.name, timeGroupId: cForm.timeGroupId,
        matchDestType: cForm.matchDestType, matchDestValue: cForm.matchDestValue || undefined,
        noMatchDestType: cForm.noMatchDestType, noMatchDestValue: cForm.noMatchDestValue || undefined,
      });
      toast({ title: "Time condition created", variant: "success" });
      setCOpen(false); await reload();
    } catch (e) { err(e); } finally { setSaving(false); }
  }
  async function saveHoliday() {
    setSaving(true);
    try {
      await api.post("/holidays", { name: hForm.name, date: hForm.date, recurring: hForm.recurring, destType: hForm.destType, destValue: hForm.destValue || undefined });
      toast({ title: "Holiday created", variant: "success" });
      setHOpen(false); await reload();
    } catch (e) { err(e); } finally { setSaving(false); }
  }
  async function delItem(kind: string, id: string) { await api.del(`/${kind}/${id}`); await reload(); }

  const rangeText = (r: Range) => `${r.weekdayStart != null ? WD[r.weekdayStart] : "Any"}–${r.weekdayEnd != null ? WD[r.weekdayEnd] : "Any"} ${r.timeStart ?? "00:00"}–${r.timeEnd ?? "24:00"}`;

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Time Routing" description="Business hours, time conditions and holidays." />
      <div className="flex flex-col gap-6">
        {/* Time groups */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Time groups</h3>
            <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setGOpen(true)}>Add group</Button>
          </div>
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <div><span className="font-medium text-ink">{g.name}</span>
                  <div className="mt-1 flex flex-wrap gap-1">{g.ranges.map((r, i) => <Badge key={i} variant="neutral">{rangeText(r)}</Badge>)}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delItem("time-groups", g.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
              </div>
            ))}
            {groups.length === 0 && <p className="py-3 text-center text-sm text-ink-subtle">No time groups yet.</p>}
          </div>
        </Card>

        {/* Time conditions */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Time conditions</h3>
            <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setCForm({ name: "", timeGroupId: groups[0]?.id ?? "", matchDestType: "extension", matchDestValue: "", noMatchDestType: "hangup", noMatchDestValue: "" }); setCOpen(true); }}>Add condition</Button>
          </div>
          <div className="flex flex-col gap-2">
            {conditions.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <div><span className="font-medium text-ink">{c.name}</span>
                  <p className="text-xs text-ink-muted">In hours → <Badge variant="success">{c.matchDestType} {c.matchDestValue}</Badge> · else → <Badge variant="neutral">{c.noMatchDestType} {c.noMatchDestValue}</Badge></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delItem("time-conditions", c.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
              </div>
            ))}
            {conditions.length === 0 && <p className="py-3 text-center text-sm text-ink-subtle">No time conditions yet.</p>}
          </div>
        </Card>

        {/* Holidays */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Holidays</h3>
            <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => { setHForm({ name: "", date: "", recurring: false, destType: "hangup", destValue: "" }); setHOpen(true); }}>Add holiday</Button>
          </div>
          <div className="flex flex-col gap-2">
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                <div><span className="font-medium text-ink">{h.name}</span>
                  <p className="text-xs text-ink-muted">{h.date}{h.recurring ? " (yearly)" : ""} → <Badge variant="neutral">{h.destType} {h.destValue}</Badge></p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delItem("holidays", h.id)}><Trash2 className="h-4 w-4 text-danger" /></Button>
              </div>
            ))}
            {holidays.length === 0 && <p className="py-3 text-center text-sm text-ink-subtle">No holidays yet.</p>}
          </div>
        </Card>
      </div>

      {/* Group modal */}
      <Modal open={gOpen} onClose={() => !saving && setGOpen(false)} size="xl" title="Add time group"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setGOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveGroup}>Create</Button></div>}>
        <div className="flex flex-col gap-4">
          <Input label="Name" value={gForm.name} onChange={(e) => setGForm({ ...gForm, name: e.target.value })} />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Ranges</span>
              <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={addRange}>Add range</Button>
            </div>
            <div className="flex flex-col gap-2">
              {gForm.ranges.map((r, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl border border-line p-2">
                  <div className="col-span-3"><Select label={i === 0 ? "From day" : undefined} options={WD_OPTS} value={String(r.weekdayStart ?? 1)} onChange={(e) => setRange(i, { weekdayStart: Number(e.target.value) })} /></div>
                  <div className="col-span-3"><Select label={i === 0 ? "To day" : undefined} options={WD_OPTS} value={String(r.weekdayEnd ?? 5)} onChange={(e) => setRange(i, { weekdayEnd: Number(e.target.value) })} /></div>
                  <div className="col-span-2"><Input label={i === 0 ? "Start" : undefined} placeholder="09:00" value={r.timeStart ?? ""} onChange={(e) => setRange(i, { timeStart: e.target.value })} /></div>
                  <div className="col-span-2"><Input label={i === 0 ? "End" : undefined} placeholder="17:00" value={r.timeEnd ?? ""} onChange={(e) => setRange(i, { timeEnd: e.target.value })} /></div>
                  <div className="col-span-2 flex justify-center pb-1"><Button variant="ghost" size="icon" onClick={() => rmRange(i)} disabled={gForm.ranges.length === 1}><X className="h-4 w-4 text-danger" /></Button></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Condition modal */}
      <Modal open={cOpen} onClose={() => !saving && setCOpen(false)} size="lg" title="Add time condition"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveCondition}>Create</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} />
          <Select label="Time group" options={groupOpts} value={cForm.timeGroupId} onChange={(e) => setCForm({ ...cForm, timeGroupId: e.target.value })} />
          <Select label="In-hours destination" options={DEST_TYPES} value={cForm.matchDestType} onChange={(e) => setCForm({ ...cForm, matchDestType: e.target.value })} />
          <Input label="Value" value={cForm.matchDestValue} onChange={(e) => setCForm({ ...cForm, matchDestValue: e.target.value })} />
          <Select label="Out-of-hours destination" options={DEST_TYPES} value={cForm.noMatchDestType} onChange={(e) => setCForm({ ...cForm, noMatchDestType: e.target.value })} />
          <Input label="Value" value={cForm.noMatchDestValue} onChange={(e) => setCForm({ ...cForm, noMatchDestValue: e.target.value })} />
        </div>
      </Modal>

      {/* Holiday modal */}
      <Modal open={hOpen} onClose={() => !saving && setHOpen(false)} size="md" title="Add holiday"
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setHOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={saveHoliday}>Create</Button></div>}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Name" value={hForm.name} onChange={(e) => setHForm({ ...hForm, name: e.target.value })} />
          <Input label="Date" type="date" value={hForm.date} onChange={(e) => setHForm({ ...hForm, date: e.target.value })} />
          <Select label="Destination" options={DEST_TYPES} value={hForm.destType} onChange={(e) => setHForm({ ...hForm, destType: e.target.value })} />
          <Input label="Value" value={hForm.destValue} onChange={(e) => setHForm({ ...hForm, destValue: e.target.value })} />
          <div className="sm:col-span-2"><Toggle checked={hForm.recurring} onCheckedChange={(v) => setHForm({ ...hForm, recurring: v })} label="Repeats yearly" /></div>
        </div>
      </Modal>
    </div>
  );
}
