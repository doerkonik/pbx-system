"use client";

/**
 * FOP2 live-monitor store: mirrors the backend channel map. Fetches a one-time
 * snapshot, then applies WebSocket diffs (call:started / agent:status_changed /
 * call:bridged / call:ended). Re-syncs the snapshot on every (re)connect so a
 * dropped socket can't leave the grid stale. Queue data is refreshed (throttled)
 * whenever a queue:updated diff arrives — still event-driven, never polled.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useTelephonyEvents } from "./ws";

export interface ChannelState {
  channelId: string;
  channelName?: string;
  extension?: string;
  agentId?: string;
  callerNumber?: string;
  callerName?: string;
  state: "ringing" | "talking" | "hold" | "idle";
  bridgeId?: string;
  connectedTo?: string;
  connectedName?: string;
  startedAt: string;
  answeredAt?: string;
  direction?: string;
}

export interface QueueRow {
  queue: string;
  calls: number;
  longestWait: number;
  membersAvailable: number;
  membersTotal: number;
  abandoned: number;
}

export interface AgentRow {
  extension: string;
  presence: string;
  reason: string;
}

export function useMonitorChannels() {
  const [channels, setChannels] = useState<Map<string, ChannelState>>(new Map());
  const [queues, setQueues] = useState<QueueRow[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const queueThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await api.get<ChannelState[]>("/monitor/channels");
      const m = new Map<string, ChannelState>();
      for (const c of snap) m.set(c.channelId, c);
      setChannels(m);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadQueues = useCallback(async () => {
    try {
      const wb = await api.get<{ queues: QueueRow[]; agents: AgentRow[] }>("/monitoring/wallboard");
      setQueues(wb.queues ?? []);
      setAgents(wb.agents ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
    void loadQueues();
  }, [loadSnapshot, loadQueues]);

  const applyDiff = useCallback(
    (event: string, diff: { channelId?: string; data: Record<string, unknown> }) => {
      const id = diff.channelId;
      if (!id && event !== "queue:updated") return;
      setChannels((prev) => {
        const next = new Map(prev);
        if (event === "call:ended" && id) {
          next.delete(id);
        } else if (event === "call:started" && id) {
          next.set(id, { channelId: id, state: "idle", startedAt: new Date().toISOString(), ...(diff.data as any), });
        } else if ((event === "agent:status_changed" || event === "call:bridged") && id) {
          const cur = next.get(id);
          next.set(id, {
            ...(cur ?? { channelId: id, state: "idle", startedAt: new Date().toISOString() }),
            ...(diff.data as any),
            channelId: id,
          });
        }
        return next;
      });
    },
    [],
  );

  const scheduleQueueRefresh = useCallback(() => {
    if (queueThrottle.current) return;
    queueThrottle.current = setTimeout(() => {
      queueThrottle.current = null;
      void loadQueues();
    }, 1500);
  }, [loadQueues]);

  const { connected } = useTelephonyEvents({
    onMonitorDiff: (event, diff) => {
      if (event === "queue:updated") scheduleQueueRefresh();
      else applyDiff(event, diff);
    },
  });

  // Re-sync the full snapshot whenever the socket (re)connects.
  useEffect(() => {
    if (connected) {
      void loadSnapshot();
      void loadQueues();
    }
  }, [connected, loadSnapshot, loadQueues]);

  return {
    channels: [...channels.values()],
    queues,
    agents,
    connected,
    loaded,
    reload: loadSnapshot,
  };
}
