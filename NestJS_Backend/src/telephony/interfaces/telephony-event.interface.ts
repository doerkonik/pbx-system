import { AgentPresence, TelephonyEvent } from '../../common/enums';

export interface PartyId {
  num?: string;
  name?: string;
}

/**
 * Single consistent shape every AMI/ARI event is normalized into before it is
 * published to Redis. The WebSocket gateway and live-state writer only ever see
 * this shape — they never touch raw Asterisk payloads.
 */
export interface NormalizedTelephonyEvent {
  event: TelephonyEvent;
  timestamp: string; // ISO-8601
  source: 'ami' | 'ari';
  channel?: string;
  channelState?: string;
  uniqueid?: string;
  linkedid?: string;
  callerId?: PartyId;
  connectedLine?: PartyId;
  /** Endpoint/extension the event concerns, when resolvable. */
  extension?: string;
  queue?: string;
  member?: string;
  presence?: AgentPresence;
  reason?: string;
  position?: number;
  waitSec?: number;
  holdTimeSec?: number;
  parkingSlot?: string;
  parkerDialString?: string;
  bridgeId?: string;
  digit?: string;
  /** Registration/contact status for endpoints & trunks. */
  contactStatus?: string;
  /** Original raw event for debugging / fields we did not model. */
  raw?: Record<string, any>;
}

export interface ConnectionStateEvent {
  ami: 'connected' | 'disconnected' | 'connecting';
  ari: 'connected' | 'disconnected' | 'connecting';
  timestamp: string;
}
