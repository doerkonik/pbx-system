export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  AGENT = 'agent',
}

/** Live presence/telephony state surfaced on the realtime dashboard. */
export enum AgentPresence {
  IDLE = 'idle',
  RINGING = 'ringing',
  IN_CALL = 'in_call',
  ON_HOLD = 'on_hold',
  PAUSED = 'paused',
  /** After-call work (wrap-up) — agent finishing notes/disposition. */
  ACW = 'acw',
  /** Do-not-disturb — agent has flagged themselves unavailable. */
  DND = 'dnd',
  OFFLINE = 'offline',
}

/** Reason codes for a queue pause / break (dual-write to agent_status_log). */
export enum BreakReason {
  LUNCH = 'lunch',
  REST = 'rest',
  MEETING = 'meeting',
  TRAINING = 'training',
  ADMIN = 'admin',
  OTHER = 'other',
}

export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  INTERNAL = 'internal',
}

/** Outbound campaign dial mode. Only `preview` is implemented today. */
export enum CampaignMode {
  PREVIEW = 'preview',
  PROGRESSIVE = 'progressive',
  PREDICTIVE = 'predictive',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DONE = 'done',
}

export enum CampaignContactStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  DONE = 'done',
  DNC = 'dnc',
}

/** Lifecycle of a QA call evaluation. */
export enum QaEvaluationStatus {
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
}

/** High-level grouping for agent call-disposition / wrap-up codes. */
export enum DispositionCategory {
  SALE = 'sale',
  CALLBACK = 'callback',
  NO_ANSWER = 'no_answer',
  NOT_INTERESTED = 'not_interested',
  COMPLAINT = 'complaint',
  SUPPORT = 'support',
  OTHER = 'other',
}

export enum TrunkAuthType {
  REGISTRATION = 'registration',
  IP = 'ip',
}

export enum BlacklistDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BOTH = 'both',
}

export enum IvrDestinationType {
  EXTENSION = 'extension',
  QUEUE = 'queue',
  IVR = 'ivr',
  MISC_DESTINATION = 'misc_destination',
  VOICEMAIL = 'voicemail',
  HANGUP = 'hangup',
}

/**
 * Destination a routing rule (inbound route / time condition / holiday) can
 * point at. Superset of IvrDestinationType with conference + time_condition so
 * routes can chain into time-based logic. Stored as a plain varchar column and
 * validated at the DTO layer (see CallForwarding.forwardType precedent).
 */
export enum RouteDestinationType {
  EXTENSION = 'extension',
  QUEUE = 'queue',
  IVR = 'ivr',
  MISC_DESTINATION = 'misc_destination',
  VOICEMAIL = 'voicemail',
  CONFERENCE = 'conference',
  TIME_CONDITION = 'time_condition',
  HANGUP = 'hangup',
}

export enum QueueStrategy {
  RINGALL = 'ringall',
  LEASTRECENT = 'leastrecent',
  FEWESTCALLS = 'fewestcalls',
  RANDOM = 'random',
  RRMEMORY = 'rrmemory',
  LINEAR = 'linear',
  WRANDOM = 'wrandom',
}

export enum MiscDestinationType {
  EXTERNAL_NUMBER = 'external_number',
  ANNOUNCEMENT = 'announcement',
  HANGUP = 'hangup',
}

export enum RecordingScope {
  EXTENSION = 'extension',
  QUEUE = 'queue',
  TRUNK = 'trunk',
  GLOBAL = 'global',
}

export enum TransferType {
  BLIND = 'blind',
  ATTENDED = 'attended',
}

/** How a ring group rings its members. */
export enum RingGroupStrategy {
  /** Ring every member at once; first to answer wins. */
  RINGALL = 'ringall',
  /** Ring members one after another in listed order. */
  HUNT = 'hunt',
  /** Like hunt, but starts after the last member who answered. */
  MEMORYHUNT = 'memoryhunt',
}

/** Lifecycle of a queue callback request. */
export enum CallbackStatus {
  PENDING = 'pending',
  DIALING = 'dialing',
  DONE = 'done',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/** Supervisor call-monitoring level (ChanSpy). */
export enum SpyMode {
  /** Silent monitoring — supervisor hears both parties. */
  LISTEN = 'listen',
  /** Coaching — supervisor is heard only by the agent. */
  WHISPER = 'whisper',
  /** Full join — supervisor is heard by both parties. */
  BARGE = 'barge',
}

/** Normalized telephony event names published on Redis by the telephony module. */
export enum TelephonyEvent {
  ENDPOINT_STATE = 'endpoint.state',
  AGENT_PRESENCE = 'agent.presence',
  CALL_START = 'call.start',
  CALL_RINGING = 'call.ringing',
  CALL_ANSWERED = 'call.answered',
  CALL_HOLD = 'call.hold',
  CALL_UNHOLD = 'call.unhold',
  CALL_HANGUP = 'call.hangup',
  QUEUE_CALLER_JOIN = 'queue.caller.join',
  QUEUE_CALLER_LEAVE = 'queue.caller.leave',
  QUEUE_CALLER_ABANDON = 'queue.caller.abandon',
  QUEUE_MEMBER_STATUS = 'queue.member.status',
  QUEUE_SNAPSHOT = 'queue.snapshot',
  AGENT_PAUSE = 'agent.pause',
  AGENT_UNPAUSE = 'agent.unpause',
  PARK_ADD = 'park.add',
  PARK_REMOVE = 'park.remove',
  BRIDGE_ENTER = 'bridge.enter',
  BRIDGE_LEAVE = 'bridge.leave',
  DTMF = 'dtmf',
  RECORDING_STARTED = 'recording.started',
  RECORDING_STOPPED = 'recording.stopped',
  CONNECTION_STATE = 'connection.state',
}
