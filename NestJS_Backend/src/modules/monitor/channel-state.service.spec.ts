import { ChannelStateService } from './channel-state.service';
import { TelephonyEvent } from '../../common/enums';
import { NormalizedTelephonyEvent } from '../../telephony/interfaces/telephony-event.interface';

function ev(p: Partial<NormalizedTelephonyEvent> & { event: TelephonyEvent }): NormalizedTelephonyEvent {
  return { timestamp: '2026-07-10T00:00:00.000Z', source: 'ami', ...p } as NormalizedTelephonyEvent;
}

describe('ChannelStateService — bridge / connectedTo tracking', () => {
  let svc: ChannelStateService;
  beforeEach(() => (svc = new ChannelStateService()));

  it('links a caller and an agent once they share a bridge', () => {
    // Inbound trunk leg (caller 5551234) and the answering agent leg (ext 1001).
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A', channel: 'PJSIP/trunk-a', channelState: 'Ring', callerId: { num: '5551234', name: 'ACME' } }));
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'B', channel: 'PJSIP/1001-b', extension: '1001', channelState: 'Ring', callerId: { num: '5551234' } }));
    svc.apply(ev({ event: TelephonyEvent.CALL_ANSWERED, uniqueid: 'A', channelState: 'Up' }));
    svc.apply(ev({ event: TelephonyEvent.CALL_ANSWERED, uniqueid: 'B', extension: '1001', channelState: 'Up' }));

    // No bridge yet -> nobody connected.
    expect(svc.getChannel('B')?.connectedTo).toBeUndefined();

    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'A', bridgeId: 'X', channel: 'PJSIP/trunk-a' }));
    const bridgeDiffs = svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'B', bridgeId: 'X', extension: '1001' }));

    // Agent 1001 is now talking to caller 5551234, and vice-versa.
    expect(svc.getChannel('B')?.connectedTo).toBe('5551234');
    expect(svc.getChannel('A')?.connectedTo).toBe('1001');
    expect(svc.getChannel('B')?.state).toBe('talking');
    expect(bridgeDiffs.some((d) => d.event === 'call:bridged')).toBe(true);
  });

  it('clears the peer relationship + removes the channel on hangup', () => {
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A', callerId: { num: '5551234' } }));
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'B', extension: '1001' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'A', bridgeId: 'X' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'B', bridgeId: 'X', extension: '1001' }));
    expect(svc.getChannel('B')?.connectedTo).toBe('5551234');

    const diffs = svc.apply(ev({ event: TelephonyEvent.CALL_HANGUP, uniqueid: 'A' }));

    expect(svc.getChannel('A')).toBeUndefined();
    expect(svc.getChannel('B')?.connectedTo).toBeUndefined();
    expect(diffs.some((d) => d.event === 'call:ended' && d.channelId === 'A')).toBe(true);
  });

  it('emits a status diff only when the state actually changes', () => {
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A', extension: '1001', channelState: 'Ring' }));
    const first = svc.apply(ev({ event: TelephonyEvent.CALL_ANSWERED, uniqueid: 'A', channelState: 'Up' }));
    const again = svc.apply(ev({ event: TelephonyEvent.CALL_ANSWERED, uniqueid: 'A', channelState: 'Up' }));
    expect(first.some((d) => d.event === 'agent:status_changed')).toBe(true);
    expect(again).toHaveLength(0); // idempotent — no duplicate diff
  });

  it('treats a 3+ party bridge as a conference and re-links when it drops to 2', () => {
    for (const id of ['A', 'B', 'C']) {
      svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: id, extension: `x${id}` }));
      svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: id, bridgeId: 'CONF', extension: `x${id}` }));
    }
    expect(svc.getChannel('A')?.connectedTo).toMatch(/^conference/);

    // C leaves -> A and B are now a plain 2-party call again.
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_LEAVE, uniqueid: 'C', bridgeId: 'CONF' }));
    expect(svc.getChannel('A')?.connectedTo).toBe('xB');
    expect(svc.getChannel('B')?.connectedTo).toBe('xA');
    expect(svc.getChannel('C')?.connectedTo).toBeUndefined();
  });

  it('re-links on an attended transfer (channel moves bridge without a leave)', () => {
    // Caller C talking to agent 1001 in bridge X.
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'C', callerId: { num: '5551234' } }));
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A1', extension: '1001' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'C', bridgeId: 'X' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'A1', bridgeId: 'X', extension: '1001' }));
    expect(svc.getChannel('C')?.connectedTo).toBe('1001');

    // Transfer completes: agent 1002 is the target; C is moved into bridge Y
    // with A2 (1002) — note NO explicit BridgeLeave for C first.
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A2', extension: '1002' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'A2', bridgeId: 'Y', extension: '1002' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'C', bridgeId: 'Y' }));

    // C is now with 1002; the old agent 1001 is no longer linked to anyone.
    expect(svc.getChannel('C')?.connectedTo).toBe('1002');
    expect(svc.getChannel('A1')?.connectedTo).toBeUndefined();
    expect(svc.getChannel('A2')?.connectedTo).toBe('5551234');
  });

  it('marks a parked call as hold and clears its peer', () => {
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'C', callerId: { num: '5551234' } }));
    svc.apply(ev({ event: TelephonyEvent.CALL_START, uniqueid: 'A', extension: '1001' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'C', bridgeId: 'X' }));
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_ENTER, uniqueid: 'A', bridgeId: 'X', extension: '1001' }));

    // Agent parks the caller: C leaves the bridge, then a ParkedCall event.
    svc.apply(ev({ event: TelephonyEvent.BRIDGE_LEAVE, uniqueid: 'C', bridgeId: 'X' }));
    const diffs = svc.apply(ev({ event: TelephonyEvent.PARK_ADD, uniqueid: 'C', parkingSlot: '701' }));

    expect(svc.getChannel('C')?.state).toBe('hold');
    expect(svc.getChannel('C')?.connectedTo).toBeUndefined();
    expect(svc.getChannel('A')?.connectedTo).toBeUndefined();
    expect(diffs.some((d) => d.event === 'agent:status_changed')).toBe(true);
  });
});
