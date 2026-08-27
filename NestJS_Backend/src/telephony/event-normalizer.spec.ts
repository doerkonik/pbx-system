import { EventNormalizer } from './event-normalizer';
import { AgentPresence, TelephonyEvent } from '../common/enums';

const FIXED = '2026-07-07T00:00:00.000Z';

describe('EventNormalizer', () => {
  describe('helpers', () => {
    it('extracts extension from a PJSIP channel name', () => {
      expect(EventNormalizer.extensionFromChannel('PJSIP/1001-00000abc')).toBe(
        '1001',
      );
      expect(EventNormalizer.extensionFromChannel('Local/foo')).toBeUndefined();
      expect(EventNormalizer.extensionFromChannel(undefined)).toBeUndefined();
    });

    it('extracts extension from a member interface', () => {
      expect(EventNormalizer.extensionFromInterface('PJSIP/2002')).toBe('2002');
      expect(EventNormalizer.extensionFromInterface('PJSIP/2002@ctx')).toBe(
        '2002',
      );
    });

    it('maps channel state to presence', () => {
      expect(EventNormalizer.presenceFromChannelState('Up')).toBe(
        AgentPresence.IN_CALL,
      );
      expect(EventNormalizer.presenceFromChannelState('Ringing')).toBe(
        AgentPresence.RINGING,
      );
      expect(EventNormalizer.presenceFromChannelState('Down')).toBe(
        AgentPresence.IDLE,
      );
      expect(EventNormalizer.presenceFromChannelState('weird')).toBeUndefined();
    });
  });

  describe('fromAmi', () => {
    it('returns null for unmodeled events', () => {
      expect(EventNormalizer.fromAmi({ Event: 'SomethingElse' })).toBeNull();
    });

    it('normalizes Newchannel to CALL_START with extension', () => {
      const ev = EventNormalizer.fromAmi(
        {
          Event: 'Newchannel',
          Channel: 'PJSIP/1001-000001',
          Uniqueid: '1720000000.1',
          CallerIDNum: '1001',
          CallerIDName: 'Alice',
        },
        FIXED,
      );
      expect(ev).toMatchObject({
        event: TelephonyEvent.CALL_START,
        source: 'ami',
        extension: '1001',
        uniqueid: '1720000000.1',
        timestamp: FIXED,
        callerId: { num: '1001', name: 'Alice' },
      });
    });

    it('normalizes Newstate Up to CALL_ANSWERED (in_call)', () => {
      const ev = EventNormalizer.fromAmi(
        { Event: 'Newstate', Channel: 'PJSIP/1001-1', ChannelStateDesc: 'Up' },
        FIXED,
      );
      expect(ev?.event).toBe(TelephonyEvent.CALL_ANSWERED);
      expect(ev?.presence).toBe(AgentPresence.IN_CALL);
    });

    it('normalizes Hold/Unhold with presence', () => {
      expect(
        EventNormalizer.fromAmi({ Event: 'Hold', Channel: 'PJSIP/1001-1' })
          ?.presence,
      ).toBe(AgentPresence.ON_HOLD);
      expect(
        EventNormalizer.fromAmi({ Event: 'Unhold', Channel: 'PJSIP/1001-1' })
          ?.presence,
      ).toBe(AgentPresence.IN_CALL);
    });

    it('normalizes Hangup to CALL_HANGUP with a reason and idle presence', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'Hangup',
        Channel: 'PJSIP/1001-1',
        Cause: '16',
        'Cause-txt': 'Normal Clearing',
      });
      expect(ev?.event).toBe(TelephonyEvent.CALL_HANGUP);
      expect(ev?.reason).toBe('16 Normal Clearing');
      expect(ev?.presence).toBe(AgentPresence.IDLE);
    });

    it('normalizes QueueCallerJoin with position', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'QueueCallerJoin',
        Queue: 'support',
        Position: '3',
      });
      expect(ev).toMatchObject({
        event: TelephonyEvent.QUEUE_CALLER_JOIN,
        queue: 'support',
        position: 3,
      });
    });

    it('normalizes QueueMemberPause paused=1 to AGENT_PAUSE with reason', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'QueueMemberPause',
        Queue: 'support',
        Interface: 'PJSIP/2002',
        Paused: '1',
        Reason: 'lunch',
      });
      expect(ev?.event).toBe(TelephonyEvent.AGENT_PAUSE);
      expect(ev?.extension).toBe('2002');
      expect(ev?.reason).toBe('lunch');
      expect(ev?.presence).toBe(AgentPresence.PAUSED);
    });

    it('normalizes QueueMemberPause paused=0 to AGENT_UNPAUSE', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'QueueMemberPause',
        Interface: 'PJSIP/2002',
        Paused: '0',
      });
      expect(ev?.event).toBe(TelephonyEvent.AGENT_UNPAUSE);
      expect(ev?.presence).toBe(AgentPresence.IDLE);
    });

    it('normalizes ParkedCall / UnParkedCall', () => {
      expect(
        EventNormalizer.fromAmi({
          Event: 'ParkedCall',
          ParkingSpace: '701',
          Channel: 'PJSIP/1001-1',
        })?.event,
      ).toBe(TelephonyEvent.PARK_ADD);
      expect(
        EventNormalizer.fromAmi({ Event: 'UnParkedCall', ParkingSpace: '701' })
          ?.event,
      ).toBe(TelephonyEvent.PARK_REMOVE);
    });

    it('normalizes ContactStatus Reachable to idle presence', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'ContactStatus',
        EndpointName: '1001',
        ContactStatus: 'Reachable',
      });
      expect(ev?.event).toBe(TelephonyEvent.ENDPOINT_STATE);
      expect(ev?.presence).toBe(AgentPresence.IDLE);
      expect(ev?.contactStatus).toBe('Reachable');
    });

    it('drops <unknown> caller id parts', () => {
      const ev = EventNormalizer.fromAmi({
        Event: 'Newchannel',
        Channel: 'PJSIP/1001-1',
        CallerIDNum: '<unknown>',
        CallerIDName: '<unknown>',
      });
      expect(ev?.callerId).toBeUndefined();
    });
  });

  describe('fromAri', () => {
    it('normalizes StasisStart to CALL_START', () => {
      const ev = EventNormalizer.fromAri(
        {
          type: 'StasisStart',
          channel: {
            id: 'abc',
            name: 'PJSIP/1001-1',
            state: 'Ring',
            caller: { number: '1001', name: 'Alice' },
          },
        },
        FIXED,
      );
      expect(ev).toMatchObject({
        event: TelephonyEvent.CALL_START,
        source: 'ari',
        extension: '1001',
        uniqueid: 'abc',
      });
    });

    it('normalizes ChannelStateChange Up to CALL_ANSWERED', () => {
      const ev = EventNormalizer.fromAri({
        type: 'ChannelStateChange',
        channel: { id: 'x', name: 'PJSIP/1001-1', state: 'Up' },
      });
      expect(ev?.event).toBe(TelephonyEvent.CALL_ANSWERED);
      expect(ev?.presence).toBe(AgentPresence.IN_CALL);
    });

    it('normalizes ChannelDtmfReceived to DTMF with digit', () => {
      const ev = EventNormalizer.fromAri({
        type: 'ChannelDtmfReceived',
        digit: '5',
        channel: { id: 'x', name: 'PJSIP/1001-1' },
      });
      expect(ev?.event).toBe(TelephonyEvent.DTMF);
      expect(ev?.digit).toBe('5');
    });

    it('returns null for unmodeled ARI events', () => {
      expect(EventNormalizer.fromAri({ type: 'DeviceStateChanged' })).toBeNull();
    });
  });
});
