"use client";
/** Admin › Call forwarding — set forwarding for any extension. */
import { useEffect, useState } from "react";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Button, Select, Input, Toggle, Spinner, useToast } from "@/components/ui";

interface Ext { id: string; extensionNumber: string; }
const TYPES = [{ label: "Always", value: "unconditional" }, { label: "When busy", value: "busy" }, { label: "No answer", value: "noanswer" }];

export default function AdminForwardingPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [exts, setExts] = useState<Ext[]>([]);
  const [ext, setExt] = useState("");
  const [rule, setRule] = useState({ enabled: false, forwardTo: "", forwardType: "unconditional" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { void api.get<PaginatedResult<Ext>>("/extensions", { params: { limit: 200 } }).then((r) => { setExts(r.data); if (r.data[0]) setExt(r.data[0].extensionNumber); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!ext) return;
    void api.get<any>(`/call-forwarding/${ext}`).then((r) => setRule({ enabled: r.enabled, forwardTo: r.forwardTo ?? "", forwardType: r.forwardType ?? "unconditional" })).catch(() => setRule({ enabled: false, forwardTo: "", forwardType: "unconditional" }));
  }, [ext]);

  async function save() {
    setBusy(true);
    try { await api.put(`/call-forwarding/${ext}`, rule); toast({ title: "Saved", variant: "success" }); }
    catch (e) { toast({ title: "Failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" }); }
    finally { setBusy(false); }
  }
  async function clear() { setBusy(true); try { await api.del(`/call-forwarding/${ext}`); setRule({ enabled: false, forwardTo: "", forwardType: "unconditional" }); toast({ title: "Cleared", variant: "success" }); } finally { setBusy(false); } }

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Call forwarding" description="Configure forwarding for any extension." />
      <Card className="max-w-lg space-y-5 p-6">
        <Select label="Extension" value={ext} onChange={(e) => setExt(e.target.value)} options={exts.map((x) => ({ label: x.extensionNumber, value: x.extensionNumber }))} />
        <Toggle checked={rule.enabled} onCheckedChange={(v) => setRule({ ...rule, enabled: v })} label="Enable forwarding" />
        <Select label="Condition" options={TYPES} disabled={!rule.enabled} value={rule.forwardType} onChange={(e) => setRule({ ...rule, forwardType: e.target.value })} />
        <Input label="Forward to" disabled={!rule.enabled} value={rule.forwardTo} onChange={(e) => setRule({ ...rule, forwardTo: e.target.value })} />
        <div className="flex justify-between"><Button variant="ghost" onClick={clear} disabled={busy}>Clear</Button><Button variant="primary" loading={busy} onClick={save}>Save</Button></div>
      </Card>
    </div>
  );
}
