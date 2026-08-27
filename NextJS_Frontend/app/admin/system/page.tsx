"use client";
/** Admin › System — host resources, telephony/SIP status, ping. */
import { useCallback, useEffect, useState } from "react";
import { Cpu, MemoryStick, HardDrive, Server, Radio, Wifi } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { formatDuration } from "@/lib/utils";
import { PageHeader, Card, Badge, Button, Input, Spinner, useToast } from "@/components/ui";

interface ServerStatus {
  hostname: string; platform: string; arch: string; osUptimeSec: number; processUptimeSec: number;
  cpu: { cores: number; loadAvg: [number, number, number]; usagePct: number };
  memory: { totalBytes: number; usedBytes: number; usedPct: number };
  disk: { path: string; totalBytes: number; usedBytes: number; usedPct: number } | null;
}
interface TelephonyStatus {
  connection: { ami: string; ari: string };
  activeCalls: number; endpointsKnown: number; endpointsOnline: number;
  trunks: Record<string, string>;
}

const gb = (b: number) => `${(b / 1e9).toFixed(1)} GB`;
const barColor = (pct: number) => (pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-success");

function Meter({ label, pct, detail, icon }: { label: string; pct: number; detail: string; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-ink">{icon}{label}</span>
        <span className="text-lg font-bold text-ink">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-muted">{detail}</p>
    </Card>
  );
}

export default function SystemPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [srv, setSrv] = useState<ServerStatus | null>(null);
  const [tel, setTel] = useState<TelephonyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState("8.8.8.8");
  const [pinging, setPinging] = useState(false);
  const [pingOut, setPingOut] = useState<string>("");

  const load = useCallback(async () => {
    const [s, t] = await Promise.allSettled([
      api.get<ServerStatus>("/system/status"),
      api.get<TelephonyStatus>("/system/telephony"),
    ]);
    if (s.status === "fulfilled") setSrv(s.value);
    if (t.status === "fulfilled") setTel(t.value);
    setLoading(false);
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [user, load]);

  async function ping() {
    setPinging(true); setPingOut("");
    try {
      const r = await api.post<{ reachable: boolean; output: string }>("/system/ping", { host });
      setPingOut(r.output);
    } catch (e) { toast({ title: "Ping failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setPinging(false); }
  }

  const connBadge = (s: string) =>
    <Badge variant={s === "connected" ? "success" : s === "connecting" ? "warn" : "danger"}>{s}</Badge>;

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="System" description="Server resources, SIP status and diagnostics." />
      {loading && !srv ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Resource meters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Meter label="CPU" pct={srv?.cpu.usagePct ?? 0} icon={<Cpu className="h-4 w-4 text-ink-subtle" />}
              detail={`${srv?.cpu.cores ?? 0} cores · load ${srv?.cpu.loadAvg.map((n) => n.toFixed(2)).join(" ") ?? ""}`} />
            <Meter label="Memory" pct={srv?.memory.usedPct ?? 0} icon={<MemoryStick className="h-4 w-4 text-ink-subtle" />}
              detail={srv ? `${gb(srv.memory.usedBytes)} / ${gb(srv.memory.totalBytes)}` : ""} />
            <Meter label="Disk" pct={srv?.disk?.usedPct ?? 0} icon={<HardDrive className="h-4 w-4 text-ink-subtle" />}
              detail={srv?.disk ? `${gb(srv.disk.usedBytes)} / ${gb(srv.disk.totalBytes)}` : "n/a"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Host + telephony */}
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink"><Server className="h-4 w-4" /> Host</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-ink-muted">Hostname</dt><dd className="text-ink">{srv?.hostname}</dd>
                <dt className="text-ink-muted">Platform</dt><dd className="text-ink">{srv?.platform} / {srv?.arch}</dd>
                <dt className="text-ink-muted">OS uptime</dt><dd className="text-ink">{formatDuration(srv?.osUptimeSec ?? 0)}</dd>
                <dt className="text-ink-muted">App uptime</dt><dd className="text-ink">{formatDuration(srv?.processUptimeSec ?? 0)}</dd>
              </dl>
              <h3 className="mb-3 mt-5 flex items-center gap-2 text-base font-semibold text-ink"><Radio className="h-4 w-4" /> Telephony</h3>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-ink-muted">AMI</dt><dd>{connBadge(tel?.connection.ami ?? "unknown")}</dd>
                <dt className="text-ink-muted">ARI</dt><dd>{connBadge(tel?.connection.ari ?? "unknown")}</dd>
                <dt className="text-ink-muted">Active calls</dt><dd className="text-ink">{tel?.activeCalls ?? 0}</dd>
                <dt className="text-ink-muted">Endpoints online</dt><dd className="text-ink">{tel?.endpointsOnline ?? 0} / {tel?.endpointsKnown ?? 0}</dd>
              </dl>
              {tel && Object.keys(tel.trunks).length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-ink-muted">Trunk registrations</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tel.trunks).map(([name, status]) => (
                      <Badge key={name} variant={/register/i.test(status) ? "success" : "danger"}>{name}: {status}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Ping */}
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink"><Wifi className="h-4 w-4" /> Ping</h3>
              <div className="flex items-end gap-2">
                <div className="flex-1"><Input label="Host or IP" value={host} onChange={(e) => setHost(e.target.value)} /></div>
                <Button variant="primary" loading={pinging} onClick={ping}>Ping</Button>
              </div>
              {pingOut && (
                <pre className="scrollbar-thin mt-3 max-h-56 overflow-auto rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">{pingOut}</pre>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
