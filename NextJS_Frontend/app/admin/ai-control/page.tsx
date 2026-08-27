"use client";
/**
 * Admin › AI Control — dial-plan settings for the AI agent (test extension,
 * press-3 agents, ring time, recording) plus live container health, logs and
 * restart. Applying dial settings regenerates the AVR dialplan and reloads
 * Asterisk over AMI; restart recreates the Docker containers.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Server,
  RefreshCw,
  RotateCw,
  PhoneCall,
  Save,
  ScrollText,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { formatDuration } from "@/lib/utils";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  Toggle,
  Select,
  Spinner,
  useToast,
} from "@/components/ui";

interface ContainerHealth {
  service: string;
  status: string;
  uptimeSec: number | null;
  image: string | null;
  cpuPerc: string | null;
  memUsage: string | null;
}
interface AiConfigView {
  aiExten: string;
  press3Agents: string;
  ringSeconds: number;
  recordCalls: boolean;
}

export default function AiControlPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();

  const [health, setHealth] = useState<ContainerHealth[]>([]);
  const [tele, setTele] = useState<AiConfigView | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [logService, setLogService] = useState("avr-sts-gemini");
  const [logs, setLogs] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      setHealth(await api.get<ContainerHealth[]>("/ai-agent/health"));
    } catch {
      /* transient during restart */
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const c = await api.get<AiConfigView>("/ai-agent/config");
      setTele({
        aiExten: c.aiExten,
        press3Agents: c.press3Agents,
        ringSeconds: c.ringSeconds,
        recordCalls: c.recordCalls,
      });
    } catch (e) {
      toast({
        title: "Could not load settings",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadConfig();
      void loadHealth();
    }
  }, [user, loadConfig, loadHealth]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => void loadHealth(), 5000);
    return () => clearInterval(id);
  }, [user, loadHealth]);

  const setTeleField = <K extends keyof AiConfigView>(
    k: K,
    v: AiConfigView[K],
  ) => setTele((t) => (t ? { ...t, [k]: v } : t));

  async function applyDial() {
    if (!tele) return;
    setApplying(true);
    try {
      await api.put("/ai-agent/telephony", {
        aiExten: tele.aiExten,
        press3Agents: tele.press3Agents,
        ringSeconds: Number(tele.ringSeconds),
        recordCalls: tele.recordCalls,
      });
      toast({
        title: "Dial settings applied",
        description: "Asterisk dialplan reloaded.",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Apply failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setApplying(false);
    }
  }

  async function restart(service?: string) {
    setRestarting(service ?? "all");
    try {
      await api.post("/ai-agent/restart", service ? { service } : {});
      toast({
        title: "Restarted",
        description: service ? service : "both containers",
        variant: "success",
      });
      setTimeout(() => void loadHealth(), 2500);
    } catch (e) {
      toast({
        title: "Restart failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setRestarting(null);
    }
  }

  async function loadLogs() {
    setLogLoading(true);
    try {
      const r = await api.get<{ service: string; logs: string }>(
        "/ai-agent/logs",
        { params: { service: logService, lines: 150 } },
      );
      setLogs(r.logs || "(no output)");
    } catch (e) {
      toast({
        title: "Could not load logs",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setLogLoading(false);
    }
  }

  if (authLoading || !user || loading || !tele) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Control"
        description="Dial-plan settings, container health, logs and restart for the AI agent."
      />

      {/* Container health */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Server className="h-4 w-4 text-accent" /> AVR containers
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void loadHealth()}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCw className="h-4 w-4" />}
              loading={restarting === "all"}
              onClick={() => restart()}
            >
              Restart both
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {health.map((h) => (
            <div
              key={h.service}
              className="rounded-xl border border-line-soft bg-surface-muted p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-ink">{h.service}</span>
                <Badge variant={h.status === "running" ? "success" : "danger"}>
                  {h.status}
                </Badge>
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-xs text-ink-muted">
                <dt>Uptime</dt>
                <dd className="text-ink">
                  {h.uptimeSec != null ? formatDuration(h.uptimeSec) : "—"}
                </dd>
                <dt>CPU</dt>
                <dd className="text-ink">{h.cpuPerc ?? "—"}</dd>
                <dt>Memory</dt>
                <dd className="text-ink">{h.memUsage ?? "—"}</dd>
              </dl>
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RotateCw className="h-4 w-4" />}
                  loading={restarting === h.service}
                  onClick={() => restart(h.service)}
                >
                  Restart
                </Button>
              </div>
            </div>
          ))}
          {health.length === 0 && (
            <p className="text-sm text-ink-muted">No container data.</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dial-plan settings */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <PhoneCall className="h-4 w-4 text-accent" /> Dial-plan settings
          </h3>
          <div className="flex flex-col gap-4">
            <Input
              label="AI test extension"
              hint="Dial this internally to talk to the AI (2–6 digits)."
              value={tele.aiExten}
              onChange={(e) => setTeleField("aiExten", e.target.value)}
            />
            <Input
              label="Agents to ring on ‘press 3’"
              hint="&-joined extensions, e.g. 102&103."
              value={tele.press3Agents}
              onChange={(e) => setTeleField("press3Agents", e.target.value)}
            />
            <Input
              label="Ring seconds before AI takes over"
              type="number"
              min={1}
              max={60}
              value={String(tele.ringSeconds)}
              onChange={(e) =>
                setTeleField("ringSeconds", Number(e.target.value))
              }
            />
            <Toggle
              checked={tele.recordCalls}
              onCheckedChange={(v) => setTeleField("recordCalls", v)}
              label="Record AI calls"
            />
            <div>
              <Button
                variant="primary"
                leftIcon={<Save className="h-4 w-4" />}
                loading={applying}
                onClick={applyDial}
              >
                Apply dial settings
              </Button>
              <p className="mt-2 text-xs text-ink-muted">
                Applying regenerates the AVR dialplan and reloads Asterisk. Safe —
                it rolls back automatically if the reload fails.
              </p>
            </div>
          </div>
        </Card>

        {/* Logs */}
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ScrollText className="h-4 w-4 text-accent" /> Logs
            </h3>
            <div className="flex items-center gap-2">
              <Select
                options={[
                  { value: "avr-sts-gemini", label: "avr-sts-gemini" },
                  { value: "avr-core", label: "avr-core" },
                ]}
                value={logService}
                onChange={(e) => setLogService(e.target.value)}
                containerClassName="w-44"
              />
              <Button
                variant="secondary"
                size="sm"
                loading={logLoading}
                onClick={loadLogs}
              >
                Load
              </Button>
            </div>
          </div>
          <pre className="scrollbar-thin h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-darkcard p-3 text-xs text-darkcard-ink">
            {logs || "Select a container and click Load."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
