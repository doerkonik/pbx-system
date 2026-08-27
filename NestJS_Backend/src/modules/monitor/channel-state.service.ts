import { Injectable, Logger } from '@nestjs/common';
import { TelephonyEvent } from '../../common/enums';
import { NormalizedTelephonyEvent } from '../../telephony/interfaces/telephony-event.interface';
import {
  ChannelLiveState,
  ChannelState,
  MonitorDiff,
} from './interfaces/channel-state.interface';

/**
 * Authoritative in-memory live-channel map + bridge tracking. Pure event-driven:
 * `apply(ev)` folds one NormalizedTelephonyEvent into the map and returns the
 * diffs to broadcast. No I/O here — the listener owns the transport, so this
 * stays trivially unit-testable and swappable (e.g. back onto Redis) later.
 */
@Injectable()
export class ChannelStateService {
  private readonly logger = new Logger(ChannelStateService.name);

  /** channelId -> live state. */
  private readonly channels = new Map<string, ChannelState>();
  /** bridgeId -> set of channelIds currently in it. */
  private readonly bridges = new Map<string, Set<string>>();

  /** Full snapshot for a newly-connected client (initial paint only). */
  snapshot(): ChannelState[] {
    return [...this.channels.values()];
  }

  getChannel(channelId: string): ChannelState | undefined {
    return this.channels.get(channelId);
  }

  /** Fold an event into the map; returns the diffs to emit (empty if no change). */
  apply(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    switch (ev.event) {
      case TelephonyEvent.CALL_START:
        return this.onStart(ev);
      case TelephonyEvent.CALL_RINGING:
        return this.onState(ev, 'ringing');
      case TelephonyEvent.CALL_ANSWERED:
        return this.onState(ev, 'talking');
      case TelephonyEvent.CALL_HOLD:
        return this.onState(ev, 'hold');
      case TelephonyEvent.CALL_UNHOLD:
        return this.onState(ev, 'talking');
      case TelephonyEvent.CALL_HANGUP:
        return this.onHangup(ev);
      case TelephonyEvent.BRIDGE_ENTER:
        return this.onBridgeEnter(ev);
      case TelephonyEvent.BRIDGE_LEAVE:
        return this.onBridgeLeave(ev);
      case TelephonyEvent.PARK_ADD:
        return this.onPark(ev);
      case TelephonyEvent.QUEUE_CALLER_JOIN:
      case TelephonyEvent.QUEUE_CALLER_LEAVE:
      case TelephonyEvent.QUEUE_CALLER_ABANDON:
      case TelephonyEvent.QUEUE_MEMBER_STATUS:
      case TelephonyEvent.AGENT_PAUSE:
      case TelephonyEvent.AGENT_UNPAUSE:
        return this.onQueue(ev);
      default:
        return [];
    }
  }

  /* ------------------------------ channels ----------------------------- */

  private ensure(ev: NormalizedTelephonyEvent): ChannelState | null {
    const id = ev.uniqueid;
    if (!id) return null;
    let ch = this.channels.get(id);
    if (!ch) {
      ch = {
        channelId: id,
        channelName: ev.channel,
        extension: ev.extension,
        callerNumber: ev.callerId?.num,
        callerName: ev.callerId?.name,
        state: this.stateFrom(ev),
        startedAt: ev.timestamp,
      };
      this.channels.set(id, ch);
    }
    // Backfill fields that may only appear on later events.
    if (!ch.channelName && ev.channel) ch.channelName = ev.channel;
    if (!ch.extension && ev.extension) ch.extension = ev.extension;
    if (!ch.callerNumber && ev.callerId?.num) ch.callerNumber = ev.callerId.num;
    if (!ch.callerName && ev.callerId?.name) ch.callerName = ev.callerId.name;
    return ch;
  }

  private onStart(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    if (!ev.uniqueid) return [];
    const existed = this.channels.has(ev.uniqueid);
    const ch = this.ensure(ev);
    if (!ch || existed) return [];
    return [{ event: 'call:started', channelId: ch.channelId, data: { ...ch } }];
  }

  private onState(ev: NormalizedTelephonyEvent, state: ChannelLiveState): MonitorDiff[] {
    const ch = this.ensure(ev);
    if (!ch) return [];
    if (state === 'talking' && !ch.answeredAt) ch.answeredAt = ev.timestamp;
    if (ch.state === state) return [];
    ch.state = state;
    return [
      { event: 'agent:status_changed', channelId: ch.channelId, data: { state, extension: ch.extension } },
    ];
  }

  private onHangup(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    const id = ev.uniqueid;
    if (!id) return [];
    const ch = this.channels.get(id);
    if (!ch) return [];

    const diffs: MonitorDiff[] = [];
    // Leaving any bridge clears peer relationships first.
    if (ch.bridgeId) diffs.push(...this.leaveBridge(id, ch.bridgeId));
    this.channels.delete(id);
    diffs.push({ event: 'call:ended', channelId: id, data: { extension: ch.extension } });
    return diffs;
  }

  /* ------------------------------- bridges ----------------------------- */

  private onBridgeEnter(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    const id = ev.uniqueid;
    const bridgeId = ev.bridgeId;
    if (!id || !bridgeId) return [];
    const ch = this.ensure(ev);
    if (!ch) return [];
    const diffs: MonitorDiff[] = [];

    // Defensive: a transfer can move a channel to a new bridge without a
    // preceding leave — detach it from the old bridge first so stale links
    // don't linger.
    if (ch.bridgeId && ch.bridgeId !== bridgeId) {
      const old = this.bridges.get(ch.bridgeId);
      if (old) {
        old.delete(id);
        if (old.size === 0) this.bridges.delete(ch.bridgeId);
        else diffs.push(...this.recomputeBridge(ch.bridgeId));
      }
    }

    ch.bridgeId = bridgeId;
    const members = this.bridges.get(bridgeId) ?? new Set<string>();
    members.add(id);
    this.bridges.set(bridgeId, members);

    diffs.push(...this.recomputeBridge(bridgeId));
    return diffs;
  }

  /** A parked call has left its bridge and is on hold in the parking lot. */
  private onPark(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    const ch = this.ensure(ev);
    if (!ch || ch.state === 'hold') return [];
    ch.state = 'hold';
    return [
      { event: 'agent:status_changed', channelId: ch.channelId, data: { state: 'hold', extension: ch.extension } },
    ];
  }

  private onBridgeLeave(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    const id = ev.uniqueid;
    const bridgeId = ev.bridgeId;
    if (!id || !bridgeId) return [];
    return this.leaveBridge(id, bridgeId);
  }

  private leaveBridge(channelId: string, bridgeId: string): MonitorDiff[] {
    const members = this.bridges.get(bridgeId);
    const diffs: MonitorDiff[] = [];
    const ch = this.channels.get(channelId);
    if (ch && (ch.connectedTo || ch.bridgeId)) {
      ch.connectedTo = undefined;
      ch.connectedName = undefined;
      ch.bridgeId = undefined;
      diffs.push({ event: 'call:bridged', channelId, data: { connectedTo: undefined } });
    }
    if (members) {
      members.delete(channelId);
      if (members.size === 0) this.bridges.delete(bridgeId);
      else diffs.push(...this.recomputeBridge(bridgeId));
    }
    return diffs;
  }

  /**
   * Recompute connectedTo for every member of a bridge. A 2-party bridge links
   * the two legs; a bigger bridge is treated as a conference.
   */
  private recomputeBridge(bridgeId: string): MonitorDiff[] {
    const members = [...(this.bridges.get(bridgeId) ?? [])]
      .map((id) => this.channels.get(id))
      .filter((c): c is ChannelState => !!c);
    const diffs: MonitorDiff[] = [];

    for (const ch of members) {
      let connectedTo: string | undefined;
      let connectedName: string | undefined;
      if (members.length === 2) {
        const peer = members.find((m) => m.channelId !== ch.channelId)!;
        connectedTo = this.identity(peer);
        connectedName = peer.callerName;
      } else if (members.length > 2) {
        connectedTo = `conference (${members.length})`;
      }
      if (ch.connectedTo !== connectedTo) {
        ch.connectedTo = connectedTo;
        ch.connectedName = connectedName;
        diffs.push({
          event: 'call:bridged',
          channelId: ch.channelId,
          data: { connectedTo, connectedName, extension: ch.extension, state: ch.state },
        });
      }
    }
    return diffs;
  }

  /** The label to show as "talking to": prefer the peer's extension, else its number. */
  private identity(ch: ChannelState): string | undefined {
    return ch.extension ?? ch.callerNumber ?? ch.channelName;
  }

  /* ------------------------------- queues ------------------------------ */

  private onQueue(ev: NormalizedTelephonyEvent): MonitorDiff[] {
    return [
      {
        event: 'queue:updated',
        data: {
          queue: ev.queue,
          member: ev.member,
          extension: ev.extension,
          presence: ev.presence,
          position: ev.position,
          reason: ev.reason,
        },
      },
    ];
  }

  private stateFrom(ev: NormalizedTelephonyEvent): ChannelLiveState {
    const s = (ev.channelState ?? '').toLowerCase();
    if (s === 'up') return 'talking';
    if (s === 'ring' || s === 'ringing') return 'ringing';
    return 'idle';
  }
}
