/**
 * Central registry of every Redis channel and key pattern. Mirrored in
 * redis_configuration.md. Keep both in sync.
 *
 * All keys are additionally namespaced by REDIS_KEY_PREFIX (ioredis keyPrefix),
 * so a bare `agent:state:1001` becomes `pbx:agent:state:1001` on the wire.
 */

/** Pub/sub channels. Telephony module publishes; WS gateway subscribes. */
export const CHANNELS = {
  /** All normalized telephony events (single fan-out channel). */
  TELEPHONY_EVENTS: 'telephony.events',
  /** Connection state changes for AMI/ARI (for /health + dashboard banner). */
  TELEPHONY_CONNECTION: 'telephony.connection',
  /** Supervisor monitoring pushes (SLA alerts, spy notices) — staff-only. */
  MONITORING_EVENTS: 'monitoring.events',
  /** In-app notifications + direct messages, routed to a specific user room. */
  NOTIFICATION_EVENTS: 'notification.events',
} as const;

export const KEYS = {
  /** Live per-agent presence hash: pbx:agent:state:<extension>. TTL-refreshed. */
  agentState: (extension: string) => `agent:state:${extension}`,
  /** Live per-endpoint state: pbx:endpoint:state:<id>. */
  endpointState: (id: string) => `endpoint:state:${id}`,
  /** Live queue snapshot hash: pbx:queue:snapshot:<name>. */
  queueSnapshot: (name: string) => `queue:snapshot:${name}`,
  /** Set of all known agent extensions (for dashboard enumeration). */
  agentIndex: () => `index:agents`,
  /** Set of all queue names. */
  queueIndex: () => `index:queues`,
  /** Live active calls hash keyed by channel id: pbx:call:<uniqueid>. */
  activeCall: (uniqueid: string) => `call:${uniqueid}`,
  /** Set of active call ids. */
  activeCallIndex: () => `index:calls`,
  /** Parked call hash: pbx:park:<slot>. */
  parkedCall: (slot: string) => `park:${slot}`,
  /** Set of occupied parking slots. */
  parkIndex: () => `index:parks`,
  /** Conference participants set: pbx:conf:<room>. */
  conference: (room: string) => `conf:${room}`,
  /** Connection state key for health checks. */
  connectionState: () => `telephony:connection`,
} as const;

/** TTLs (seconds) for ephemeral live-state keys. Refreshed by heartbeats. */
export const TTL = {
  AGENT_STATE: 90,
  ENDPOINT_STATE: 90,
  QUEUE_SNAPSHOT: 120,
  ACTIVE_CALL: 60 * 60 * 4, // safety cap; normally deleted on hangup
  PARKED_CALL: 60 * 60,
} as const;
