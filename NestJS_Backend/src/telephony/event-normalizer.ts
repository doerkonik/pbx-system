import { AgentPresence, TelephonyEvent } from '../common/enums';
import { NormalizedTelephonyEvent } from './interfaces/telephony-event.interface';

/**
 * Pure translation layer: raw Asterisk AMI/ARI events -> NormalizedTelephonyEvent.
 * No side effects, no I/O — kept pure so it is exhaustively unit-testable
 * (see event-normalizer.spec.ts). Returns null for events we intentionally drop.
 */
export class EventNormalizer {
  /** ISO timestamp helper — accepts an override so callers can pass a fixed clock. */
  private static now(iso?: string): string {
    return iso ?? new Date().toISOString();
  }

  /**
   * Extract a bare extension/endpoint id from a channel name.
   * "PJSIP/1001-00000abc" -> "1001". Returns undefined if not a PJSIP channel.
   */
  static extensionFromChannel(channel?: string): string | undefined {
    if (!channel) return undefined;
    const m = /^PJSIP\/([^-]+)-/.exec(channel);
    return m ? m[1] : undefined;
  }

  /** Map an AMI ChannelStateDesc to a coarse agent presence. */
  static presenceFromChannelState(state?: string): AgentPresence | undefined {
    switch ((state ?? '').toLowerCase()) {
      case 'ring':
      case 'ringing':
        return AgentPresence.RINGING;
      case 'up':
        return AgentPresence.IN_CALL;
      case 'down':
        return AgentPresence.IDLE;
      default:
        return undefined;
    }
  }

  /**
   * Normalize a raw AMI event object (keys are AMI header names).
   * `nowIso` lets tests inject a deterministic timestamp.
   */
  static fromAmi(
    raw: Record<string, any>,
    nowIso?: string,
  ): NormalizedTelephonyEvent | null {
    const e = (raw.Event ?? raw.event ?? '') as string;
    const base = {
      timestamp: this.now(nowIso),
      source: 'ami' as const,
      channel: raw.Channel,
      channelState: raw.ChannelStateDesc,
      uniqueid: raw.Uniqueid,
      linkedid: raw.Linkedid,
      callerId: this.party(raw.CallerIDNum, raw.CallerIDName),
      connectedLine: this.party(raw.ConnectedLineNum, raw.ConnectedLineName),
      raw,
    };

    switch (e) {
      case 'Newchannel':
        return {
          ...base,
          event: TelephonyEvent.CALL_START,
          extension: this.extensionFromChannel(raw.Channel),
        };

      case 'Newstate': {
        const presence = this.presenceFromChannelState(raw.ChannelStateDesc);
        return {
          ...base,
          event:
            raw.ChannelStateDesc === 'Ringing'
              ? TelephonyEvent.CALL_RINGING
              : raw.ChannelStateDesc === 'Up'
                ? TelephonyEvent.CALL_ANSWERED
                : TelephonyEvent.ENDPOINT_STATE,
          extension: this.extensionFromChannel(raw.Channel),
          presence,
        };
      }

      case 'Hold':
        return {
          ...base,
          event: TelephonyEvent.CALL_HOLD,
          extension: this.extensionFromChannel(raw.Channel),
          presence: AgentPresence.ON_HOLD,
        };

      case 'Unhold':
        return {
          ...base,
          event: TelephonyEvent.CALL_UNHOLD,
          extension: this.extensionFromChannel(raw.Channel),
          presence: AgentPresence.IN_CALL,
        };

      case 'Hangup':
        return {
          ...base,
          event: TelephonyEvent.CALL_HANGUP,
          extension: this.extensionFromChannel(raw.Channel),
          reason: raw.Cause ? `${raw.Cause} ${raw['Cause-txt'] ?? ''}`.trim() : undefined,
          presence: AgentPresence.IDLE,
        };

      case 'QueueCallerJoin':
        return {
          ...base,
          event: TelephonyEvent.QUEUE_CALLER_JOIN,
          queue: raw.Queue,
          position: raw.Position ? Number(raw.Position) : undefined,
        };

      case 'QueueCallerLeave':
        return {
          ...base,
          event: TelephonyEvent.QUEUE_CALLER_LEAVE,
          queue: raw.Queue,
          position: raw.Position ? Number(raw.Position) : undefined,
        };

      case 'QueueCallerAbandon':
        return {
          ...base,
          event: TelephonyEvent.QUEUE_CALLER_ABANDON,
          queue: raw.Queue,
          position: raw.Position ? Number(raw.Position) : undefined,
          holdTimeSec: raw.HoldTime ? Number(raw.HoldTime) : undefined,
        };

      case 'QueueMemberStatus':
        return {
          ...base,
          event: TelephonyEvent.QUEUE_MEMBER_STATUS,
          queue: raw.Queue,
          member: raw.MemberName ?? raw.Interface,
          extension: this.extensionFromInterface(raw.Interface),
          presence:
            raw.Paused === '1'
              ? AgentPresence.PAUSED
              : this.presenceFromDeviceStatus(raw.Status),
        };

      case 'QueueMemberPause':
        return {
          ...base,
          event:
            raw.Paused === '1'
              ? TelephonyEvent.AGENT_PAUSE
              : TelephonyEvent.AGENT_UNPAUSE,
          queue: raw.Queue,
          member: raw.MemberName ?? raw.Interface,
          extension: this.extensionFromInterface(raw.Interface),
          reason: raw.Reason || undefined,
          presence:
            raw.Paused === '1' ? AgentPresence.PAUSED : AgentPresence.IDLE,
        };

      case 'ParkedCall':
        return {
          ...base,
          event: TelephonyEvent.PARK_ADD,
          parkingSlot: raw.ParkingSpace,
          parkerDialString: raw.ParkerDialString,
        };

      case 'UnParkedCall':
      case 'ParkedCallGiveUp':
      case 'ParkedCallTimeOut':
        return {
          ...base,
          event: TelephonyEvent.PARK_REMOVE,
          parkingSlot: raw.ParkingSpace,
        };

      case 'BridgeEnter':
        return {
          ...base,
          event: TelephonyEvent.BRIDGE_ENTER,
          bridgeId: raw.BridgeUniqueid,
          extension: this.extensionFromChannel(raw.Channel),
        };

      case 'BridgeLeave':
        return {
          ...base,
          event: TelephonyEvent.BRIDGE_LEAVE,
          bridgeId: raw.BridgeUniqueid,
          extension: this.extensionFromChannel(raw.Channel),
        };

      case 'DTMFEnd':
        return {
          ...base,
          event: TelephonyEvent.DTMF,
          extension: this.extensionFromChannel(raw.Channel),
          digit: raw.Digit,
        };

      // Endpoint / trunk registration status.
      case 'ContactStatus':
      case 'PeerStatus':
        return {
          ...base,
          event: TelephonyEvent.ENDPOINT_STATE,
          extension: raw.EndpointName ?? raw.Peer,
          contactStatus: raw.ContactStatus ?? raw.PeerStatus,
          presence:
            (raw.ContactStatus ?? raw.PeerStatus) === 'Reachable' ||
            (raw.PeerStatus ?? '') === 'Registered'
              ? AgentPresence.IDLE
              : AgentPresence.OFFLINE,
        };

      default:
        return null; // event we don't model — dropped, not an error
    }
  }

  /** Normalize a raw ARI event (Stasis WebSocket). */
  static fromAri(
    raw: Record<string, any>,
    nowIso?: string,
  ): NormalizedTelephonyEvent | null {
    const type = raw.type as string;
    const chan = raw.channel ?? {};
    const base = {
      timestamp: this.now(nowIso ?? raw.timestamp),
      source: 'ari' as const,
      channel: chan.name,
      channelState: chan.state,
      uniqueid: chan.id,
      callerId: this.party(chan.caller?.number, chan.caller?.name),
      connectedLine: this.party(chan.connected?.number, chan.connected?.name),
      extension: this.extensionFromChannel(chan.name),
      raw,
    };

    switch (type) {
      case 'StasisStart':
        return { ...base, event: TelephonyEvent.CALL_START };
      case 'StasisEnd':
        return { ...base, event: TelephonyEvent.CALL_HANGUP };
      case 'ChannelStateChange':
        return {
          ...base,
          event:
            chan.state === 'Up'
              ? TelephonyEvent.CALL_ANSWERED
              : chan.state === 'Ringing'
                ? TelephonyEvent.CALL_RINGING
                : TelephonyEvent.ENDPOINT_STATE,
          presence: this.presenceFromChannelState(chan.state),
        };
      case 'ChannelHold':
        return { ...base, event: TelephonyEvent.CALL_HOLD, presence: AgentPresence.ON_HOLD };
      case 'ChannelUnhold':
        return { ...base, event: TelephonyEvent.CALL_UNHOLD, presence: AgentPresence.IN_CALL };
      case 'ChannelDtmfReceived':
        return { ...base, event: TelephonyEvent.DTMF, digit: raw.digit };
      case 'ChannelHangupRequest':
      case 'ChannelDestroyed':
        return { ...base, event: TelephonyEvent.CALL_HANGUP, presence: AgentPresence.IDLE };
      case 'ChannelEnteredBridge':
        return { ...base, event: TelephonyEvent.BRIDGE_ENTER, bridgeId: raw.bridge?.id };
      case 'ChannelLeftBridge':
        return { ...base, event: TelephonyEvent.BRIDGE_LEAVE, bridgeId: raw.bridge?.id };
      default:
        return null;
    }
  }

  private static party(num?: string, name?: string) {
    const resolvedNum = num && num !== '<unknown>' ? num : undefined;
    const resolvedName = name && name !== '<unknown>' ? name : undefined;
    if (!resolvedNum && !resolvedName) return undefined;
    return { num: resolvedNum, name: resolvedName };
  }

  /** "PJSIP/1001" -> "1001". */
  static extensionFromInterface(iface?: string): string | undefined {
    if (!iface) return undefined;
    const m = /^PJSIP\/([^-@]+)/.exec(iface);
    return m ? m[1] : undefined;
  }

  /** AMI numeric device status -> presence. 1=NOT_INUSE,2=INUSE,8=RINGING... */
  private static presenceFromDeviceStatus(status?: string): AgentPresence {
    switch (status) {
      case '1':
        return AgentPresence.IDLE;
      case '2':
      case '3':
        return AgentPresence.IN_CALL;
      case '6':
      case '8':
        return AgentPresence.RINGING;
      case '5':
      case '4':
        return AgentPresence.OFFLINE;
      default:
        return AgentPresence.IDLE;
    }
  }
}
