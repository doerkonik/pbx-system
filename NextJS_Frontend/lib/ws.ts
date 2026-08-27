"use client";

/**
 * Realtime telephony transport (socket.io-client).
 *
 * - `getSocket()` returns a lazily-created singleton connected to
 *   NEXT_PUBLIC_WS_URL with `auth: { token }`.
 * - `useTelephonyEvents()` is a React hook that manages the socket
 *   lifecycle, tracks connection state, and lets callers subscribe to
 *   `telephony.event` and `telephony.connection` messages.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth-storage";
import type {
  TelephonyConnectionPayload,
  TelephonyConnectionState,
  TelephonyEventPayload,
} from "./types";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "http://10.23.88.125:3001/realtime";

let socket: Socket | null = null;

/**
 * Get (or lazily create) the shared telephony socket. Safe to call from
 * multiple components; they all share one connection.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(WS_URL, {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    auth: (cb) => cb({ token: getAccessToken() ?? "" }),
  });
  return socket;
}

/** Force-close and drop the singleton (call on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/** Push a fresh token onto the socket and reconnect (call after refresh/login). */
export function refreshSocketAuth(): void {
  if (!socket) return;
  socket.auth = { token: getAccessToken() ?? "" };
  socket.disconnect().connect();
}

export interface UseTelephonyEventsOptions {
  /** Fired for every `telephony.event` message. */
  onEvent?: (payload: TelephonyEventPayload) => void;
  /** Fired for every `telephony.connection` message. */
  onConnection?: (payload: TelephonyConnectionPayload) => void;
  /** Fired for every `monitoring.event` message (SLA alerts, spy notices). */
  onMonitoring?: (payload: Record<string, unknown>) => void;
  /** Fired for every `notification`/`message` message (in-app comms). */
  onNotification?: (event: "notification" | "message", payload: Record<string, unknown>) => void;
  /** Fired for FOP2 live-monitor diffs (call:started / agent:status_changed / …). */
  onMonitorDiff?: (
    event: MonitorEventName,
    diff: { event: string; channelId?: string; data: Record<string, unknown> },
  ) => void;
  /** Set false to opt out of connecting (e.g. before auth is ready). */
  enabled?: boolean;
}

export type MonitorEventName =
  | "call:started"
  | "agent:status_changed"
  | "call:bridged"
  | "call:ended"
  | "queue:updated";

const MONITOR_EVENTS: MonitorEventName[] = [
  "call:started",
  "agent:status_changed",
  "call:bridged",
  "call:ended",
  "queue:updated",
];

export interface UseTelephonyEventsResult {
  /** Live transport connection state. */
  connectionState: TelephonyConnectionState;
  /** Convenience boolean derived from connectionState. */
  connected: boolean;
  /** Last `telephony.connection` payload received, if any. */
  lastConnection: TelephonyConnectionPayload | null;
  /** Last `telephony.event` payload received, if any. */
  lastEvent: TelephonyEventPayload | null;
  /** Imperatively emit a message to the server. */
  emit: (event: string, ...args: unknown[]) => void;
}

/**
 * Subscribe to realtime telephony events. Returns the current connection
 * state plus the most recent payloads. Handlers passed in options are
 * invoked for each message without needing to re-render.
 */
export function useTelephonyEvents(
  options: UseTelephonyEventsOptions = {},
): UseTelephonyEventsResult {
  const { onEvent, onConnection, onMonitoring, onNotification, onMonitorDiff, enabled = true } = options;

  const [connectionState, setConnectionState] =
    useState<TelephonyConnectionState>("connecting");
  const [lastConnection, setLastConnection] =
    useState<TelephonyConnectionPayload | null>(null);
  const [lastEvent, setLastEvent] = useState<TelephonyEventPayload | null>(
    null,
  );

  // Keep latest handlers in refs so effect doesn't re-subscribe on each render.
  const onEventRef = useRef(onEvent);
  const onConnectionRef = useRef(onConnection);
  const onMonitoringRef = useRef(onMonitoring);
  const onNotificationRef = useRef(onNotification);
  const onMonitorDiffRef = useRef(onMonitorDiff);
  onEventRef.current = onEvent;
  onConnectionRef.current = onConnection;
  onMonitoringRef.current = onMonitoring;
  onNotificationRef.current = onNotification;
  onMonitorDiffRef.current = onMonitorDiff;

  useEffect(() => {
    if (!enabled) return;
    const s = getSocket();

    const handleConnect = () => setConnectionState("connected");
    const handleDisconnect = () => setConnectionState("disconnected");
    const handleReconnectAttempt = () => setConnectionState("reconnecting");
    const handleConnecting = () => setConnectionState("connecting");

    const handleEvent = (payload: TelephonyEventPayload) => {
      setLastEvent(payload);
      onEventRef.current?.(payload);
    };
    const handleConnectionMsg = (payload: TelephonyConnectionPayload) => {
      setLastConnection(payload);
      onConnectionRef.current?.(payload);
    };

    if (s.connected) setConnectionState("connected");

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.io.on("reconnect_attempt", handleReconnectAttempt);
    s.io.on("reconnect", handleConnect);
    s.io.on("open", handleConnecting);
    const handleMonitoring = (payload: Record<string, unknown>) =>
      onMonitoringRef.current?.(payload);
    const handleNotification = (payload: Record<string, unknown>) =>
      onNotificationRef.current?.("notification", payload);
    const handleMessage = (payload: Record<string, unknown>) =>
      onNotificationRef.current?.("message", payload);

    // FOP2 monitor diffs — one handler per named event.
    const monitorHandlers: Array<[MonitorEventName, (p: any) => void]> = MONITOR_EVENTS.map(
      (name) => {
        const h = (payload: any) => onMonitorDiffRef.current?.(name, payload);
        return [name, h];
      },
    );

    s.on("telephony.event", handleEvent);
    s.on("telephony.connection", handleConnectionMsg);
    s.on("monitoring.event", handleMonitoring);
    s.on("notification", handleNotification);
    s.on("message", handleMessage);
    monitorHandlers.forEach(([name, h]) => s.on(name, h));

    if (!s.connected) s.connect();

    return () => {
      s.off("connect", handleConnect);
      s.off("disconnect", handleDisconnect);
      s.io.off("reconnect_attempt", handleReconnectAttempt);
      s.io.off("reconnect", handleConnect);
      s.io.off("open", handleConnecting);
      s.off("telephony.event", handleEvent);
      s.off("telephony.connection", handleConnectionMsg);
      s.off("monitoring.event", handleMonitoring);
      s.off("notification", handleNotification);
      s.off("message", handleMessage);
      monitorHandlers.forEach(([name, h]) => s.off(name, h));
    };
  }, [enabled]);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    getSocket().emit(event, ...args);
  }, []);

  return {
    connectionState,
    connected: connectionState === "connected",
    lastConnection,
    lastEvent,
    emit,
  };
}
