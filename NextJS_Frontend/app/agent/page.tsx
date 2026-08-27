"use client";

/**
 * Agent › Dashboard — session control, current break, today's personal KPIs,
 * and the embedded softphone. Agents only ever see their own data.
 */
import { useCallback, useEffect, useState } from "react";
import { LogIn, LogOut, Coffee, BellOff, Clock, PhoneCall, CheckCircle2, PhoneMissed } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Card,
  Button,
  KPICard,
  ProgressRing,
  Spinner,
  StatusPill,
  useToast,
} from "@/components/ui";
import { Softphone } from "@/components/softphone/Softphone";

interface Session {
  id: string;
  loginAt: string;
  logoutAt: string | null;
  durationSec: number | null;
}
interface Break {
  id: string;
  reason: string;
  startedAt: string;
}
interface AgentReport {
  callsHandled?: number;
  callsAnswered?: number;
  callsMissed?: number;
  avgHandleSec?: number;
  totalTalkSec?: number;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

export default function AgentDashboard() {
  const { user, loading: authLoading } = useRequireAuth("agent");
  const { toast } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [currentBreak, setCurrentBreak] = useState<Break | null>(null);
  const [report, setReport] = useState<AgentReport | null>(null);
  const [agentState, setAgentState] = useState<{ dnd: boolean; acw: boolean }>({ dnd: false, acw: false });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, b, r, st] = await Promise.allSettled([
      api.get<Session | null>("/agent-sessions/current"),
      api.get<Break | null>("/breaks/current"),
      api.get<any>("/reports/agents", { params: { granularity: "day" } }),
      api.get<{ dnd: boolean; acw: boolean }>("/agent-state"),
    ]);
    if (s.status === "fulfilled") setSession(s.value);
    if (b.status === "fulfilled") setCurrentBreak(b.value);
    if (r.status === "fulfilled") {
      const v: any = r.value;
      const row = v?.totals ?? (Array.isArray(v) ? v[0] : v?.data?.[0]) ?? v ?? null;
      setReport(row);
    }
    if (st.status === "fulfilled") setAgentState({ dnd: st.value.dnd, acw: st.value.acw });
  }, []);

  async function toggleDnd() {
    try {
      const r = await api.post<{ dnd: boolean; acw: boolean }>("/agent-state/dnd", { on: !agentState.dnd });
      setAgentState((s) => ({ ...s, dnd: r.dnd }));
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }
  async function toggleAcw() {
    try {
      const r = await api.post<{ dnd: boolean; acw: boolean }>("/agent-state/acw", { on: !agentState.acw });
      setAgentState((s) => ({ ...s, acw: r.acw }));
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
  }

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function toggleSession() {
    setBusy(true);
    try {
      if (session && !session.logoutAt) {
        await api.post("/agent-sessions/logout");
        toast({ title: "Logged out of queues", variant: "success" });
      } else {
        await api.post("/agent-sessions/login");
        toast({ title: "Logged in", variant: "success" });
      }
      await load();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const loggedIn = !!session && !session.logoutAt;
  const answerRate =
    report && report.callsHandled
      ? Math.round(((report.callsAnswered ?? 0) / report.callsHandled) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.fullName ?? user.username}`}
        description={`Extension ${user.extension ?? "—"}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusPill
                  variant={loggedIn ? "idle" : "offline"}
                  label={loggedIn ? "On duty" : "Off duty"}
                  dot
                />
                {currentBreak && (
                  <StatusPill variant="paused" label={`Break: ${currentBreak.reason}`} dot />
                )}
                {agentState.acw && <StatusPill variant="acw" dot />}
                {agentState.dnd && <StatusPill variant="dnd" dot />}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={agentState.acw ? "primary" : "secondary"}
                  onClick={toggleAcw}
                  leftIcon={<Clock className="h-4 w-4" />}
                >
                  {agentState.acw ? "End wrap-up" : "Wrap-up"}
                </Button>
                <Button
                  variant={agentState.dnd ? "danger" : "secondary"}
                  onClick={toggleDnd}
                  leftIcon={<BellOff className="h-4 w-4" />}
                >
                  {agentState.dnd ? "DND on" : "DND"}
                </Button>
                <Button
                  variant={loggedIn ? "secondary" : "primary"}
                  loading={busy}
                  onClick={toggleSession}
                  leftIcon={loggedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                >
                  {loggedIn ? "End session" : "Start session"}
                </Button>
              </div>
            </div>
            {session?.loginAt && (
              <p className="mt-3 text-xs text-ink-muted">
                Logged in since {new Date(session.loginAt).toLocaleTimeString()}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KPICard label="Calls handled" value={report?.callsHandled ?? 0} tone="amber" icon={<PhoneCall className="h-5 w-5" />} />
            <KPICard label="Answered" value={report?.callsAnswered ?? 0} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
            <KPICard label="Missed" value={report?.callsMissed ?? 0} tone="rose" icon={<PhoneMissed className="h-5 w-5" />} />
            <KPICard label="Avg handle" value={fmtDuration(report?.avgHandleSec ?? 0)} tone="blue" icon={<Clock className="h-5 w-5" />} />
          </div>

          <Card className="p-5">
            <div className="flex items-center gap-6">
              <ProgressRing value={answerRate} caption="Answer rate" />
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <Coffee className="h-4 w-4" /> Talk time today:{" "}
                <span className="font-medium text-ink">{fmtDuration(report?.totalTalkSec ?? 0)}</span>
              </p>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Softphone />
        </div>
      </div>
    </div>
  );
}
