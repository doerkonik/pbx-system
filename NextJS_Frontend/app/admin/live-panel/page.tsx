"use client";
/** Admin/Supervisor › Live Panel — FOP2-style real-time agent/call monitor. */
import { useEffect, useState } from "react";
import { Ear, Mic, Radio, PhoneOff, Users, Hourglass } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useMonitorChannels, type ChannelState } from "@/lib/use-monitor";
import { formatDuration } from "@/lib/utils";
import {
  PageHeader, Card, Button, StatusPill, Spinner, useToast, type StatusPillVariant,
} from "@/components/ui";

/** Client-side ticking timer — derived from startedAt, never pushed per-second. */
function LiveDuration({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return <span className="tabular-nums">{formatDuration(sec)}</span>;
}

const stateVariant = (s?: string): StatusPillVariant =>
  s === "talking" ? "in_call" : s === "ringing" ? "ringing" : s === "hold" ? "on_hold"
    : s === "paused" ? "paused" : s === "offline" ? "offline" : "idle";

export default function LivePanelPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const { channels, queues, agents, connected, loaded } = useMonitorChannels();
  const [names, setNames] = useState<Record<string, string>>({});

  // Best-effort extension→name map (admin only; supervisors just see numbers).
  useEffect(() => {
    void api.get<{ data: { extensionNumber: string; displayName?: string | null }[] }>("/extensions", { params: { limit: 200 } })
      .then((r) => setNames(Object.fromEntries(r.data.map((e) => [e.extensionNumber, e.displayName ?? ""]))))
      .catch(() => undefined);
  }, []);

  // Roster = known agents ∪ any extension currently on a channel.
  const chByExt = new Map<string, ChannelState>();
  for (const c of channels) if (c.extension) chByExt.set(c.extension, c);
  const roster = Array.from(
    new Set([...agents.map((a) => a.extension), ...chByExt.keys()]),
  ).sort();
  const presenceByExt = Object.fromEntries(agents.map((a) => [a.extension, a.presence]));

  async function spy(targetExtension: string, mode: "listen" | "whisper" | "barge") {
    try {
      await api.post("/monitoring/spy", { targetExtension, mode });
      toast({ title: `${mode} started on ${targetExtension}`, variant: "success" });
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }
  async function hangup(channelName?: string) {
    if (!channelName) return;
    try {
      await api.post("/monitor/hangup", { channel: channelName });
      toast({ title: "Channel hung up", variant: "success" });
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Live Panel" description="Real-time agent and call activity."
        actions={<StatusPill variant={connected ? "idle" : "offline"} label={connected ? "Live" : "Reconnecting"} dot pulse={connected} />} />

      {!loaded ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          {/* Agent grid */}
          <Card flush className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-muted/50 text-left text-sm font-bold text-ink-muted">
                    <th className="px-4 py-3 font-medium">Extension</th>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Talking to</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((ext) => {
                    const ch = chByExt.get(ext);
                    const status = ch?.state ?? presenceByExt[ext] ?? "idle";
                    const active = !!ch && ch.state !== "idle";
                    return (
                      <tr key={ext} className="border-b border-line/60 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-ink">{ext}</td>
                        <td className="px-4 py-2.5 text-ink-muted">{names[ext] || <span className="text-ink-subtle">—</span>}</td>
                        <td className="px-4 py-2.5"><StatusPill variant={stateVariant(status)} label={status} dot pulse={status === "ringing" || status === "talking"} /></td>
                        <td className="px-4 py-2.5">
                          {ch?.connectedTo
                            ? <span className="font-medium text-ink">{ch.connectedTo}{ch.connectedName ? ` · ${ch.connectedName}` : ""}</span>
                            : <span className="text-ink-subtle">—</span>}
                        </td>
                        <td className="px-4 py-2.5">{ch ? <LiveDuration since={ch.answeredAt ?? ch.startedAt} /> : <span className="text-ink-subtle">—</span>}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Listen" disabled={!active} onClick={() => spy(ext, "listen")}><Ear className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Whisper" disabled={!active} onClick={() => spy(ext, "whisper")}><Mic className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Barge" disabled={!active} onClick={() => spy(ext, "barge")}><Radio className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Hang up" disabled={!ch} onClick={() => hangup(ch?.channelName)}><PhoneOff className="h-4 w-4 text-danger" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {roster.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-subtle">No agents online.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Queue panel */}
          <Card>
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
              <Users className="h-4 w-4 text-ink-subtle" /> Queues
            </h3>
            <div className="flex flex-col gap-3">
              {queues.map((q) => (
                <div key={q.queue} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{q.queue}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                      <Hourglass className="h-3.5 w-3.5" /> {q.calls} waiting
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-ink-subtle">
                    <span>Longest {formatDuration(q.longestWait)}</span>
                    <span>{q.membersAvailable}/{q.membersTotal} available</span>
                  </div>
                </div>
              ))}
              {queues.length === 0 && <p className="text-sm text-ink-subtle">No active queues.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
