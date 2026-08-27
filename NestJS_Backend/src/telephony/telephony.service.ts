import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { CHANNELS, KEYS } from '../redis/redis.constants';
import { AmiService } from './ami.service';
import { AriService } from './ari.service';
import { LiveStateService } from './live-state.service';
import { EventNormalizer } from './event-normalizer';
import {
  ConnectionStateEvent,
  NormalizedTelephonyEvent,
} from './interfaces/telephony-event.interface';
import {
  BlacklistDirection,
  SpyMode,
  TelephonyEvent,
  TransferType,
} from '../common/enums';
import { BlacklistEntry } from '../database/entities';
import { RecordingConfig, TelephonyBehaviourConfig } from '../config/configuration';

export interface OriginateParams {
  fromExtension: string;
  to: string;
  callerId?: string;
  context?: string;
  timeoutSec?: number;
}

/**
 * The ONLY component that talks to Asterisk. It:
 *   1. consumes raw AMI + ARI events, normalizes them, projects live state to
 *      Redis, and fans them out on the Redis pub/sub channel;
 *   2. exposes typed control methods (originate/hold/transfer/pause/park/record/
 *      confbridge/queue membership) that other modules call — they never touch
 *      AMI/ARI directly.
 *
 * See DECISIONS.md for the AMI-vs-ARI split rationale.
 */
@Injectable()
export class TelephonyService implements OnModuleInit {
  private readonly logger = new Logger(TelephonyService.name);
  private connState: ConnectionStateEvent = {
    ami: 'connecting',
    ari: 'connecting',
    timestamp: new Date().toISOString(),
  };

  constructor(
    private readonly ami: AmiService,
    private readonly ari: AriService,
    private readonly redis: RedisService,
    private readonly liveState: LiveStateService,
    private readonly config: ConfigService,
    @InjectRepository(BlacklistEntry)
    private readonly blacklistRepo: Repository<BlacklistEntry>,
  ) {}

  onModuleInit(): void {
    // --- Event ingestion pipeline -----------------------------------------
    this.ami.on('event', (raw) => void this.ingest(EventNormalizer.fromAmi(raw)));
    this.ari.on('event', (raw) => void this.ingest(EventNormalizer.fromAri(raw)));

    // --- Connection state tracking ----------------------------------------
    this.ami.on('state', (s) => void this.updateConnState('ami', s));
    this.ari.on('state', (s) => void this.updateConnState('ari', s));

    // --- Blacklist enforcement + IVR handoff on Stasis entry --------------
    this.ari.on('stasisStart', (event, channel) =>
      void this.onStasisStart(event, channel),
    );
  }

  // =========================================================================
  //  Event pipeline
  // =========================================================================

  private async ingest(ev: NormalizedTelephonyEvent | null): Promise<void> {
    if (!ev) return;
    try {
      await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, ev);
      await this.liveState.apply(ev);
    } catch (err) {
      this.logger.error(`Event ingest failed: ${(err as Error).message}`);
    }
  }

  private async updateConnState(
    which: 'ami' | 'ari',
    state: ConnectionStateEvent['ami'],
  ): Promise<void> {
    this.connState = {
      ...this.connState,
      [which]: state,
      timestamp: new Date().toISOString(),
    };
    try {
      await this.redis.client.set(
        KEYS.connectionState(),
        JSON.stringify(this.connState),
      );
      await this.redis.publish(CHANNELS.TELEPHONY_CONNECTION, this.connState);
    } catch (err) {
      this.logger.error(`Conn-state publish failed: ${(err as Error).message}`);
    }
  }

  getConnectionState(): ConnectionStateEvent {
    return this.connState;
  }

  isHealthy(): { ami: boolean; ari: boolean } {
    return { ami: this.ami.isConnected(), ari: this.ari.isConnected() };
  }

  // =========================================================================
  //  Blacklist enforcement (call-start)
  // =========================================================================

  async isBlacklisted(
    num: string,
    direction: BlacklistDirection,
  ): Promise<boolean> {
    if (!num) return false;
    const rows = await this.blacklistRepo.find({
      where: { number: num, isActive: true },
    });
    return rows.some(
      (r) =>
        r.direction === BlacklistDirection.BOTH || r.direction === direction,
    );
  }

  private async onStasisStart(event: any, channel: any): Promise<void> {
    try {
      const caller = channel?.caller?.number;
      if (
        caller &&
        (await this.isBlacklisted(caller, BlacklistDirection.INBOUND))
      ) {
        this.logger.warn(`Blacklisted caller ${caller} — hanging up`);
        await channel.hangup().catch(() => undefined);
        return;
      }
      // appArgs convention: "ivr,<menuName>" routes into the IVR runner.
      const args: string[] = event?.args ?? [];
      if (args[0] === 'ivr' && args[1]) {
        // IVR execution handled by IvrRunnerService (subscribed separately).
        this.logger.debug(`Channel ${channel.id} entered IVR ${args[1]}`);
      }
    } catch (err) {
      this.logger.error(`StasisStart handling failed: ${(err as Error).message}`);
    }
  }

  // =========================================================================
  //  Call control
  // =========================================================================

  /** Click-to-dial: ring `fromExtension`, then dial `to` from the dialplan. */
  async originateCall(params: OriginateParams): Promise<{ actionId: string }> {
    const behaviour = this.config.get<TelephonyBehaviourConfig>('telephony')!;
    const res = await this.ami.action({
      Action: 'Originate',
      Channel: `PJSIP/${params.fromExtension}`,
      Context: params.context ?? 'from-internal',
      Exten: params.to,
      Priority: 1,
      CallerID: params.callerId ?? params.fromExtension,
      Timeout: (params.timeoutSec ?? 30) * 1000,
      Async: 'true',
      ChannelId: undefined,
    });
    this.logger.log(
      `Originate ${params.fromExtension} -> ${params.to} (${behaviour.stasisApp})`,
    );
    return { actionId: res.ActionID ?? '' };
  }

  /**
   * Originate a queue callback: dial the customer via a Local channel through
   * the normal outbound dialplan (from-internal), then drop the answered call
   * into the queue so the next free agent is connected.
   */
  async originateCallback(params: {
    phone: string;
    queue: string;
    callerId?: string;
  }): Promise<{ actionId: string }> {
    const res = await this.ami.action({
      Action: 'Originate',
      Channel: `Local/${params.phone}@from-internal`,
      Application: 'Queue',
      Data: params.queue,
      CallerID: params.callerId ?? `Callback <${params.phone}>`,
      Async: 'true',
    });
    this.logger.log(`Callback originate ${params.phone} -> queue ${params.queue}`);
    return { actionId: res.ActionID ?? '' };
  }

  /** Hold + start MoH on a live channel (by ARI channel id / uniqueid). */
  async holdCall(channelId: string): Promise<void> {
    const client = this.ari.getClient();
    await client.channels.hold({ channelId });
    await client.channels
      .startMoh({ channelId })
      .catch(() => undefined);
  }

  async unholdCall(channelId: string): Promise<void> {
    const client = this.ari.getClient();
    await client.channels.stopMoh({ channelId }).catch(() => undefined);
    await client.channels.unhold({ channelId });
  }

  async answerCall(channelId: string): Promise<void> {
    await this.ari.getClient().channels.answer({ channelId });
  }

  async hangupCall(channel: string): Promise<void> {
    await this.ami.action({ Action: 'Hangup', Channel: channel, Cause: 16 });
  }

  /** Blind transfer via AMI Redirect; attended via AMI Atxfer. */
  async transferCall(params: {
    channel: string;
    to: string;
    type: TransferType;
    context?: string;
  }): Promise<void> {
    const context = params.context ?? 'from-internal';
    if (params.type === TransferType.BLIND) {
      await this.ami.action({
        Action: 'Redirect',
        Channel: params.channel,
        Context: context,
        Exten: params.to,
        Priority: 1,
      });
    } else {
      await this.ami.action({
        Action: 'Atxfer',
        Channel: params.channel,
        Exten: params.to,
        Context: context,
        Priority: 1,
      });
    }
    this.logger.log(`${params.type} transfer ${params.channel} -> ${params.to}`);
  }

  // =========================================================================
  //  Queue pause / membership  (dual-write handled by callers via BreaksService)
  // =========================================================================

  async pauseAgent(interfaceName: string, reason: string, queue?: string): Promise<void> {
    await this.ami.action({
      Action: 'QueuePause',
      Interface: interfaceName,
      Paused: 'true',
      Reason: reason,
      ...(queue ? { Queue: queue } : {}),
    });
  }

  async unpauseAgent(interfaceName: string, queue?: string): Promise<void> {
    await this.ami.action({
      Action: 'QueuePause',
      Interface: interfaceName,
      Paused: 'false',
      ...(queue ? { Queue: queue } : {}),
    });
  }

  async addQueueMember(params: {
    queue: string;
    interfaceName: string;
    memberName?: string;
    penalty?: number;
    paused?: boolean;
  }): Promise<void> {
    await this.ami.action({
      Action: 'QueueAdd',
      Queue: params.queue,
      Interface: params.interfaceName,
      MemberName: params.memberName ?? params.interfaceName,
      Penalty: params.penalty ?? 0,
      Paused: params.paused ? 'true' : 'false',
      StateInterface: params.interfaceName,
    });
  }

  async removeQueueMember(queue: string, interfaceName: string): Promise<void> {
    await this.ami.action({
      Action: 'QueueRemove',
      Queue: queue,
      Interface: interfaceName,
    });
  }

  /** Set a member's penalty live (used by skill-based routing). */
  async setQueuePenalty(
    queue: string,
    interfaceName: string,
    penalty: number,
  ): Promise<void> {
    await this.ami.action({
      Action: 'QueuePenalty',
      Queue: queue,
      Interface: interfaceName,
      Penalty: penalty,
    });
  }

  // =========================================================================
  //  Parking
  // =========================================================================

  async parkCall(channel: string, announceChannel?: string): Promise<void> {
    const lot = this.config.get<TelephonyBehaviourConfig>('telephony')!.parkingLot;
    await this.ami.action({
      Action: 'Park',
      Channel: channel,
      ...(announceChannel ? { AnnounceChannel: announceChannel } : {}),
      Parkinglot: lot,
    });
  }

  // =========================================================================
  //  Recording (MixMonitor)
  // =========================================================================

  async startRecording(channel: string, fileBase: string): Promise<string> {
    const rec = this.config.get<RecordingConfig>('recording')!;
    const file = `${fileBase}.${rec.format}`;
    await this.ami.action({
      Action: 'MixMonitor',
      Channel: channel,
      File: file,
      Options: 'b', // only record when bridged
    });
    await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, {
      event: TelephonyEvent.RECORDING_STARTED,
      timestamp: new Date().toISOString(),
      source: 'ami',
      channel,
      raw: { file },
    } as NormalizedTelephonyEvent);
    return `${rec.dir}/${file}`;
  }

  async stopRecording(channel: string): Promise<void> {
    await this.ami.action({ Action: 'StopMixMonitor', Channel: channel });
  }

  /**
   * Pause recording on a channel without ending the file (PCI-DSS: mute while
   * card details are spoken). Uses MixMonitorMute so the recording resumes into
   * the same file. `resumeRecording` unmutes.
   */
  async pauseRecording(channel: string): Promise<void> {
    await this.ami.action({
      Action: 'MixMonitorMute',
      Channel: channel,
      Direction: 'both',
      State: '1',
    });
    await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, {
      event: TelephonyEvent.RECORDING_STOPPED,
      timestamp: new Date().toISOString(),
      source: 'ami',
      channel,
      raw: { paused: true },
    } as NormalizedTelephonyEvent);
  }

  async resumeRecording(channel: string): Promise<void> {
    await this.ami.action({
      Action: 'MixMonitorMute',
      Channel: channel,
      Direction: 'both',
      State: '0',
    });
    await this.redis.publish(CHANNELS.TELEPHONY_EVENTS, {
      event: TelephonyEvent.RECORDING_STARTED,
      timestamp: new Date().toISOString(),
      source: 'ami',
      channel,
      raw: { resumed: true },
    } as NormalizedTelephonyEvent);
  }

  // =========================================================================
  //  ConfBridge (ARI)
  // =========================================================================

  /** Originate an extension into a named ConfBridge bridge (created on demand). */
  async addToConference(room: string, extension: string): Promise<void> {
    const client = this.ari.getClient();
    let bridge: any;
    const bridges = await client.bridges.list();
    bridge = bridges.find((b: any) => b.name === `conf-${room}`);
    if (!bridge) {
      bridge = await client.bridges.create({
        type: 'mixing',
        name: `conf-${room}`,
      });
    }
    const channel = await client.channels.originate({
      endpoint: `PJSIP/${extension}`,
      app: this.config.get<TelephonyBehaviourConfig>('telephony')!.stasisApp,
      appArgs: `conf,${room}`,
      callerId: `Conference <${room}>`,
    });
    // The Stasis handler bridges the answered channel; store desired bridge id.
    await this.redis.client.hset(KEYS.conference(room), channel.id, extension);
  }

  // =========================================================================
  //  Supervisor monitoring (ChanSpy)
  // =========================================================================

  /**
   * Start a ChanSpy session: originate the supervisor's device into ChanSpy
   * targeting an agent's device. `listen` = silent, `whisper` = agent-only
   * coaching, `barge` = talk to both. Returns the AMI actionId.
   */
  async startChanSpy(params: {
    supervisorExtension: string;
    targetExtension: string;
    mode: SpyMode;
  }): Promise<{ actionId: string }> {
    // 'q' quiet (no announcement); 'w' whisper to spied; 'B' barge both ways.
    const optsByMode: Record<SpyMode, string> = {
      [SpyMode.LISTEN]: 'q',
      [SpyMode.WHISPER]: 'qw',
      [SpyMode.BARGE]: 'qB',
    };
    const res = await this.ami.action({
      Action: 'Originate',
      Channel: `PJSIP/${params.supervisorExtension}`,
      Application: 'ChanSpy',
      Data: `PJSIP/${params.targetExtension},${optsByMode[params.mode]}`,
      CallerID: `Spy <${params.supervisorExtension}>`,
      Async: 'true',
    });
    this.logger.log(
      `ChanSpy ${params.mode}: ${params.supervisorExtension} -> ${params.targetExtension}`,
    );
    return { actionId: res.ActionID ?? '' };
  }

  // =========================================================================
  //  Call pickup
  // =========================================================================

  /**
   * Directed call pickup: originate the picker's device into the Pickup()
   * dialplan app targeting a ringing extension, answering the call on their
   * behalf. `context` is where the target is being dialled (default from-internal).
   */
  async pickupCall(params: {
    pickerExtension: string;
    targetExtension: string;
    context?: string;
  }): Promise<{ actionId: string }> {
    const context = params.context ?? 'from-internal';
    const res = await this.ami.action({
      Action: 'Originate',
      Channel: `PJSIP/${params.pickerExtension}`,
      Application: 'Pickup',
      Data: `${params.targetExtension}@${context}`,
      CallerID: `Pickup <${params.pickerExtension}>`,
      Async: 'true',
    });
    this.logger.log(
      `Pickup ${params.pickerExtension} -> ${params.targetExtension}`,
    );
    return { actionId: res.ActionID ?? '' };
  }

  // =========================================================================
  //  Conference moderation (ARI)
  // =========================================================================

  /** Mute/unmute a channel's incoming audio (conference moderation). */
  async setChannelMute(channelId: string, mute: boolean): Promise<void> {
    const client = this.ari.getClient();
    if (mute) {
      await client.channels.mute({ channelId, direction: 'in' });
    } else {
      await client.channels.unmute({ channelId, direction: 'in' });
    }
  }

  /** AMI generic passthrough for advanced/admin actions (audited by caller). */
  async rawAction(message: Record<string, any>): Promise<any> {
    return this.ami.action(message);
  }

  /**
   * Live outbound-registration state for trunks, keyed by registration/trunk
   * name -> status (e.g. "Registered", "Rejected", "Unregistered"). Runs the
   * multi-event AMI action and collects the burst. Returns {} if AMI is down.
   */
  async getOutboundRegistrations(): Promise<Record<string, string>> {
    if (!this.ami.isConnected()) return {};
    return new Promise((resolve) => {
      const result: Record<string, string> = {};
      const actionId = `reg-${Date.now()}`;
      const cleanup = () => this.ami.removeListener('event', onEvent);
      const timer = setTimeout(() => {
        cleanup();
        resolve(result);
      }, 1500);

      const onEvent = (ev: Record<string, any>) => {
        if (ev.ActionID && ev.ActionID !== actionId) return;
        if (ev.Event === 'OutboundRegistrationDetail') {
          if (ev.ObjectName) result[ev.ObjectName] = ev.Status ?? 'Unknown';
        } else if (ev.Event === 'OutboundRegistrationDetailComplete') {
          clearTimeout(timer);
          cleanup();
          resolve(result);
        }
      };

      this.ami.on('event', onEvent);
      this.ami
        .action({
          Action: 'PJSIPShowRegistrationsOutbound',
          ActionID: actionId,
        })
        .catch(() => {
          clearTimeout(timer);
          cleanup();
          resolve(result);
        });
    });
  }

  /**
   * Qualify (OPTIONS) reachability for one endpoint's contact. This is the only
   * live health signal an IP-authenticated trunk has: it never registers, so
   * getOutboundRegistrations() reports nothing for it and the caller would
   * otherwise have no status at all.
   */
  async getContactStatus(
    endpoint: string,
  ): Promise<{ status: string; rttMs: number } | null> {
    if (!this.ami.isConnected()) return null;
    return new Promise((resolve) => {
      let result: { status: string; rttMs: number } | null = null;
      const actionId = `contact-${endpoint}-${Date.now()}`;
      const cleanup = () => this.ami.removeListener('event', onEvent);
      const timer = setTimeout(() => {
        cleanup();
        resolve(result);
      }, 1500);

      const onEvent = (ev: Record<string, any>) => {
        if (ev.ActionID && ev.ActionID !== actionId) return;
        if (ev.Event === 'ContactStatusDetail' && ev.EndpointName === endpoint) {
          result = {
            status: ev.Status ?? 'Unknown',
            rttMs: Math.round(Number(ev.RoundtripUsec ?? 0) / 1000),
          };
        } else if (ev.Event === 'EndpointDetailComplete') {
          clearTimeout(timer);
          cleanup();
          resolve(result);
        }
      };

      this.ami.on('event', onEvent);
      this.ami
        .action({
          Action: 'PJSIPShowEndpoint',
          Endpoint: endpoint,
          ActionID: actionId,
        })
        .catch(() => {
          clearTimeout(timer);
          cleanup();
          resolve(result);
        });
    });
  }
}
