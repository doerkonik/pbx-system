/**
 * Shared TypeScript types & enums mirroring the backend domain model.
 * Keep this in sync with the API. DTOs here describe the shapes returned
 * by the REST endpoints and pushed over the realtime socket.
 */

/* ------------------------------------------------------------------ */
/* Auth / users                                                       */
/* ------------------------------------------------------------------ */

export type UserRole = "admin" | "supervisor" | "agent";

/** Live presence of an agent (softphone + queue state). */
export enum AgentPresence {
  Offline = "offline",
  Idle = "idle",
  Ringing = "ringing",
  InCall = "in_call",
  OnHold = "on_hold",
  Paused = "paused",
  /** After-call work (wrap-up). */
  Acw = "acw",
  /** Do-not-disturb. */
  Dnd = "dnd",
}

/** Reason an agent is paused / on break. */
export enum BreakReason {
  Lunch = "lunch",
  Tea = "tea",
  Meeting = "meeting",
  Training = "training",
  Bathroom = "bathroom",
  Admin = "admin",
  Other = "other",
}

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  /** SIP extension number assigned to this user (agents mainly). */
  extension: string | null;
  fullName: string | null;
  email?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Returned by /auth/login when the account has 2FA enabled (step 1 of 2). */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  mfaToken: string;
}

/** /auth/login returns either full tokens or a 2FA challenge. */
export type LoginResult = LoginResponse | TwoFactorChallenge;

export function isTwoFactorChallenge(
  r: LoginResult,
): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).twoFactorRequired === true;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/* ------------------------------------------------------------------ */
/* Telephony realtime events                                          */
/* ------------------------------------------------------------------ */

/** Connection status of the realtime socket transport. */
export type TelephonyConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/** Payload for `telephony.connection`. */
export interface TelephonyConnectionPayload {
  state: TelephonyConnectionState;
  /** Backend/asterisk link health, if reported. */
  asterisk?: "up" | "down" | "unknown";
  at: string;
}

export type TelephonyEventType =
  | "call.ringing"
  | "call.answered"
  | "call.hangup"
  | "call.hold"
  | "call.unhold"
  | "agent.presence"
  | "queue.update"
  | "extension.status";

/**
 * Payload for `telephony.event` — the backend's NormalizedTelephonyEvent shape
 * (see NestJS src/telephony/interfaces/telephony-event.interface.ts). Kept
 * permissive; consumers read the fields relevant to each event.
 */
export interface TelephonyEventPayload {
  event: string;
  timestamp: string;
  source: "ami" | "ari";
  channel?: string;
  uniqueid?: string;
  extension?: string;
  queue?: string;
  member?: string;
  presence?: string;
  reason?: string;
  position?: number;
  parkingSlot?: string;
  digit?: string;
  callerId?: { num?: string; name?: string };
  connectedLine?: { num?: string; name?: string };
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AgentPresenceEventData {
  userId: string;
  extension: string;
  presence: AgentPresence;
  breakReason?: BreakReason;
  since: string;
}

/* ------------------------------------------------------------------ */
/* Core PBX entities                                                  */
/* ------------------------------------------------------------------ */

export type YesNo = "yes" | "no";

export interface Extension {
  id: string;
  extension: string;
  displayName: string;
  /** SIP secret is never returned in full by the API. */
  secretSet: boolean;
  context: string;
  voicemailEnabled: boolean;
  callerId: string;
  assignedUserId: string | null;
  online: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TrunkType = "sip" | "pjsip" | "iax2";

export interface Trunk {
  id: string;
  name: string;
  type: TrunkType;
  host: string;
  port: number;
  username: string | null;
  registration: boolean;
  registrationState: "registered" | "unregistered" | "failed" | "unknown";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OutboundRouteMatchType = "prefix" | "exact" | "regex";

export interface OutboundRoute {
  id: string;
  name: string;
  pattern: string;
  matchType: OutboundRouteMatchType;
  trunkId: string;
  stripDigits: number;
  prependDigits: string;
  priority: number;
  enabled: boolean;
}

export interface BlacklistEntry {
  id: string;
  number: string;
  reason: string | null;
  createdBy: string;
  createdAt: string;
}

export type QueueStrategy =
  | "ringall"
  | "leastrecent"
  | "fewestcalls"
  | "random"
  | "rrmemory"
  | "linear";

export interface Queue {
  id: string;
  name: string;
  displayName: string;
  strategy: QueueStrategy;
  timeout: number;
  wrapupTime: number;
  maxWaiting: number;
  memberExtensions: string[];
  slaSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CallDirection = "inbound" | "outbound" | "internal";

export type CdrDisposition =
  | "ANSWERED"
  | "NO ANSWER"
  | "BUSY"
  | "FAILED"
  | "VOICEMAIL";

export interface Cdr {
  id: string;
  uniqueId: string;
  direction: CallDirection;
  source: string;
  destination: string;
  callerName: string | null;
  queue: string | null;
  agentExtension: string | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  /** Total call duration in seconds. */
  duration: number;
  /** Talk time in seconds (post-answer). */
  billsec: number;
  disposition: CdrDisposition;
  recordingId: string | null;
}

export interface Recording {
  id: string;
  cdrId: string | null;
  fileName: string;
  /** Signed/streamable URL for playback (relative or absolute). */
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  source: string;
  destination: string;
  recordedAt: string;
}

export type IvrEntryAction =
  | "extension"
  | "queue"
  | "ivr"
  | "voicemail"
  | "hangup"
  | "playback"
  | "trunk";

export interface IvrEntry {
  /** DTMF digit (0-9, *, #) or "timeout"/"invalid". */
  digit: string;
  action: IvrEntryAction;
  /** Destination value depending on action (extension/queue id/etc). */
  target: string;
  label: string;
}

export interface IvrMenu {
  id: string;
  name: string;
  description: string | null;
  greetingAudioId: string | null;
  timeoutSeconds: number;
  maxRetries: number;
  entries: IvrEntry[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MiscDestination {
  id: string;
  name: string;
  destination: string;
  notes: string | null;
}

export interface MohClass {
  id: string;
  name: string;
  fileCount: number;
  enabled: boolean;
}

export interface ConferenceRoom {
  id: string;
  number: string;
  name: string;
  pin: string | null;
  adminPin: string | null;
  maxMembers: number;
  activeMembers: number;
  enabled: boolean;
}

export type CallForwardType = "always" | "busy" | "noanswer" | "unavailable";

export interface CallForwardRule {
  id: string;
  extension: string;
  type: CallForwardType;
  destination: string;
  enabled: boolean;
}

export interface ParkingLot {
  id: string;
  name: string;
  spaceStart: number;
  spaceEnd: number;
  timeoutSeconds: number;
  occupied: number[];
}

export interface BreakType {
  id: string;
  reason: BreakReason;
  label: string;
  /** Whether time on this break counts as paid. */
  paid: boolean;
  /** Soft cap in minutes (0 = unlimited). */
  maxMinutes: number;
  enabled: boolean;
}

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: UserRole;
  extension: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Reporting / analytics                                              */
/* ------------------------------------------------------------------ */

export interface TimeseriesPoint {
  /** ISO bucket start. */
  t: string;
  value: number;
}

export interface QueueStats {
  queue: string;
  offered: number;
  answered: number;
  abandoned: number;
  slaPercent: number;
  avgWaitSeconds: number;
  avgTalkSeconds: number;
}

export interface AgentStats {
  userId: string;
  extension: string;
  fullName: string;
  presence: AgentPresence;
  callsHandled: number;
  avgTalkSeconds: number;
  totalTalkSeconds: number;
  breakSeconds: number;
}
