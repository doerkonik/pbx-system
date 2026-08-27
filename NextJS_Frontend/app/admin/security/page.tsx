"use client";
/** Admin › Security — two-factor authentication enrolment. */
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Button, Input, Badge, Spinner, useToast } from "@/components/ui";

export default function SecurityPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get<{ enabled: boolean }>("/auth/2fa"); setEnabled(r.enabled); }
    catch { setEnabled(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);

  async function beginSetup() {
    setBusy(true);
    try { setSetup(await api.post<{ secret: string; otpauthUri: string }>("/auth/2fa/setup")); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setBusy(false); }
  }
  async function enable() {
    setBusy(true);
    try {
      await api.post("/auth/2fa/enable", { code });
      toast({ title: "Two-factor enabled", variant: "success" });
      setSetup(null); setCode(""); await load();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Invalid code", variant: "error" }); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      await api.post("/auth/2fa/disable", { code });
      toast({ title: "Two-factor disabled", variant: "success" });
      setCode(""); await load();
    } catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Invalid code", variant: "error" }); }
    finally { setBusy(false); }
  }

  if (authLoading || !user || enabled === null) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Security" description="Protect your account with two-factor authentication." />
      <Card className="max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-semibold text-ink">
            {enabled ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldOff className="h-5 w-5 text-ink-subtle" />}
            Two-factor authentication
          </span>
          <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge>
        </div>

        {enabled ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Enter a current code to turn off two-factor authentication.</p>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input label="Authenticator code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
              <Button variant="danger" loading={busy} disabled={code.length !== 6} onClick={disable}>Disable</Button>
            </div>
          </div>
        ) : setup ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Add this account to your authenticator app, then enter the 6-digit code to finish.
            </p>
            <div>
              <p className="mb-1 text-xs font-medium text-ink-muted">Secret key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink">{setup.secret}</code>
                <Button variant="secondary" size="icon" title="Copy" onClick={() => { void navigator.clipboard.writeText(setup.secret); toast({ title: "Copied", variant: "success" }); }}><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="mt-2 break-all text-[11px] text-ink-subtle">{setup.otpauthUri}</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input label="Authenticator code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} /></div>
              <Button variant="primary" loading={busy} disabled={code.length !== 6} onClick={enable}>Verify &amp; enable</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Require a one-time code from an authenticator app at sign-in.</p>
            <div><Button variant="primary" loading={busy} onClick={beginSetup}>Enable two-factor</Button></div>
          </div>
        )}
      </Card>
    </div>
  );
}
