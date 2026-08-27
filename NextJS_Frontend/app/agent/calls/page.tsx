"use client";

/** Agent › Calls — the softphone plus a live view of the agent's own calls. */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useTelephonyEvents } from "@/lib/ws";
import {
  PageHeader,
  Card,
  StatusListRow,
  Spinner,
  EmptyState,
  type StatusPillVariant,
} from "@/components/ui";
import { Softphone } from "@/components/softphone/Softphone";

interface ActiveCall {
  uniqueid: string;
  channel: string;
  extension: string;
  state: string;
  callerNum?: string;
  callerName?: string;
  connectedNum?: string;
}

const STATE_VARIANT: Record<string, StatusPillVariant> = {
  "call.start": "ringing",
  "call.ringing": "ringing",
  "call.answered": "in_call",
  "call.hold": "on_hold",
  "call.unhold": "in_call",
};

export default function AgentCallsPage() {
  const { user, loading: authLoading } = useRequireAuth("agent");
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ActiveCall[]>("/dashboard/calls");
      setCalls(Array.isArray(res) ? res : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  // Refresh on any call event that touches this agent.
  useTelephonyEvents({
    onEvent: (ev) => {
      if (typeof ev.event === "string" && ev.event.startsWith("call.")) {
        void load();
      }
    },
  });

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Calls" description="Place and manage your calls." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Softphone />
        </div>
        <div className="lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-4 text-base font-semibold text-ink">Your active calls</h3>
            {loading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : calls.length === 0 ? (
              <EmptyState title="No active calls" description="Your live calls appear here." />
            ) : (
              <div className="divide-y divide-line">
                {calls.map((c) => (
                  <StatusListRow
                    key={c.uniqueid}
                    name={c.callerName || c.callerNum || c.channel}
                    subtitle={`${c.callerNum ?? ""} → ${c.connectedNum ?? c.extension}`}
                    status={STATE_VARIANT[c.state] ?? "idle"}
                    metric={c.state.replace("call.", "")}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
