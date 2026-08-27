"use client";

/** Agent › Call forwarding — manage forwarding for the agent's own extension. */
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { PageHeader, Card, Button, Input, Select, Toggle, Spinner, useToast } from "@/components/ui";

interface Rule {
  enabled: boolean;
  forwardTo: string | null;
  forwardType: "unconditional" | "busy" | "noanswer";
}

const TYPES = [
  { label: "Always (unconditional)", value: "unconditional" },
  { label: "When busy", value: "busy" },
  { label: "On no answer", value: "noanswer" },
];

export default function AgentForwardingPage() {
  const { user, loading: authLoading } = useRequireAuth("agent");
  const { toast } = useToast();
  const ext = user?.extension;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, watch, setValue, reset } = useForm<Rule>({
    defaultValues: { enabled: false, forwardTo: "", forwardType: "unconditional" },
  });

  const load = useCallback(async () => {
    if (!ext) return;
    setLoading(true);
    try {
      const r = await api.get<Rule>(`/call-forwarding/${ext}`);
      reset({ enabled: r.enabled, forwardTo: r.forwardTo ?? "", forwardType: r.forwardType ?? "unconditional" });
    } catch {
      /* default shown */
    } finally {
      setLoading(false);
    }
  }, [ext, reset]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const onSubmit = handleSubmit(async (v) => {
    if (!ext) return;
    setSaving(true);
    try {
      await api.put(`/call-forwarding/${ext}`, v);
      toast({ title: "Forwarding saved", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setSaving(false);
    }
  });

  async function clearRule() {
    if (!ext) return;
    setSaving(true);
    try {
      await api.del(`/call-forwarding/${ext}`);
      reset({ enabled: false, forwardTo: "", forwardType: "unconditional" });
      toast({ title: "Forwarding cleared", variant: "success" });
    } catch (e) {
      toast({ title: "Clear failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  const enabled = watch("enabled");

  return (
    <div>
      <PageHeader title="Call forwarding" description={`Forward calls for extension ${ext ?? "—"}.`} />
      <Card className="max-w-lg p-6">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <Toggle checked={enabled} onCheckedChange={(v) => setValue("enabled", v)} label="Enable forwarding" />
            <Select label="Condition" options={TYPES} disabled={!enabled} {...register("forwardType")} />
            <Input label="Forward to" placeholder="e.g. 1002 or +8801…" disabled={!enabled} {...register("forwardTo")} />
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={clearRule} disabled={saving}>Clear</Button>
              <Button type="submit" variant="primary" loading={saving}>Save</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
