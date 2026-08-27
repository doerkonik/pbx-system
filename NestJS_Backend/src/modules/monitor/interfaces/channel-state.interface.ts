/**
 * FOP2-style live monitoring types (Module: monitor).
 *
 * The tracker keeps one record per live channel and derives the
 * "who's-talking-to-whom" relationship from bridge membership. State is held
 * in-memory and fed from the shared Redis telephony-event bus, so every NestJS
 * instance builds an identical map independently (multi-instance-ready without
 * shared write-state). Only diffs are emitted downstream — never full dumps.
 */

export type ChannelLiveState = 'ringing' | 'talking' | 'hold' | 'idle';

export interface ChannelState {
  /** Asterisk channel uniqueid (stable id across the channel's life). */
  channelId: string;
  /** Full channel name, e.g. "PJSIP/1001-00000abc". */
  channelName?: string;
  /** Extension/endpoint id when this is a local device leg (e.g. "1001"). */
  extension?: string;
  /** Application user id owning the extension, resolved lazily (optional). */
  agentId?: string;
  callerNumber?: string;
  callerName?: string;
  state: ChannelLiveState;
  bridgeId?: string;
  /** Peer identity (number/extension) this channel is bridged with. */
  connectedTo?: string;
  connectedName?: string;
  /** ISO — when the channel appeared (used for client-side live duration). */
  startedAt: string;
  /** ISO — when the channel was answered (state → talking). */
  answeredAt?: string;
  direction?: 'inbound' | 'outbound' | 'internal';
}

/** Named diff events broadcast to supervisor clients (Step 2 wires the WS). */
export type MonitorEventName =
  | 'call:started'
  | 'agent:status_changed'
  | 'call:bridged'
  | 'call:ended'
  | 'queue:updated';

export interface MonitorDiff {
  event: MonitorEventName;
  channelId?: string;
  /** Only the fields that changed (or a small event payload). */
  data: Partial<ChannelState> & Record<string, unknown>;
}
