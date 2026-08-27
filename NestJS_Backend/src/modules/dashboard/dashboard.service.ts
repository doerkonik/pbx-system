import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AgentPresence, UserRole } from '../../common/enums';

export interface AgentStateView {
  extension: string;
  presence: string;
  reason: string;
  channel: string;
  updatedAt: string;
}

export interface ActiveCallView {
  uniqueid: string;
  linkedid: string;
  channel: string;
  extension: string;
  state: string;
  callerNum: string;
  callerName: string;
  connectedNum: string;
  updatedAt: string;
}

export interface ParkedCallView {
  slot: string;
  channel: string;
  callerNum: string;
  callerName: string;
  parkerDialString: string;
  parkedAt: string;
}

export interface QueueSnapshotView {
  queue: string;
  calls: number;
  holdtime: number;
  talktime: number;
  completed: number;
  abandoned: number;
  longestWait: number;
  membersTotal: number;
  membersAvailable: number;
  updatedAt: string;
}

export interface DashboardSummary {
  activeCalls: number;
  agentsOnline: number;
  callsInQueue: number;
  longestWait: number;
}

/**
 * Read-only projection of the live telephony state from Redis, used for the
 * realtime dashboard's initial load (subsequent deltas arrive over WebSocket).
 * Role scoping is applied per endpoint: admins see everything; agents are
 * limited to their own extension / calls.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly redis: RedisService) {}

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('This resource is restricted to admins');
    }
  }

  private toNum(value: string | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  async getAgents(user: AuthenticatedUser): Promise<AgentStateView[]> {
    let extensions = await this.redis.client.smembers(KEYS.agentIndex());
    if (!this.isAdmin(user)) {
      const ext = user.extension;
      extensions = ext ? extensions.filter((e) => e === ext) : [];
    }

    const results: AgentStateView[] = [];
    for (const ext of extensions) {
      const endpoint = await this.redis.client.hgetall(KEYS.endpointState(ext));
      const agent = await this.redis.client.hgetall(KEYS.agentState(ext));
      const hasEndpoint = endpoint && Object.keys(endpoint).length > 0;
      const hasAgent = agent && Object.keys(agent).length > 0;
      if (!hasEndpoint && !hasAgent) continue;

      results.push({
        extension: ext,
        presence:
          endpoint.presence || agent.presence || AgentPresence.OFFLINE,
        // Pause reason (agentState) takes precedence over endpoint reason.
        reason: agent.reason || endpoint.reason || '',
        channel: endpoint.channel || '',
        updatedAt: endpoint.updatedAt || agent.updatedAt || '',
      });
    }
    return results.sort((a, b) => a.extension.localeCompare(b.extension));
  }

  async getQueues(user: AuthenticatedUser): Promise<QueueSnapshotView[]> {
    this.assertAdmin(user);
    const names = await this.redis.client.smembers(KEYS.queueIndex());
    const results: QueueSnapshotView[] = [];
    for (const name of names) {
      const hash = await this.redis.client.hgetall(KEYS.queueSnapshot(name));
      if (!hash || Object.keys(hash).length === 0) continue;
      results.push({
        queue: hash.queue || name,
        calls: this.toNum(hash.calls),
        holdtime: this.toNum(hash.holdtime),
        talktime: this.toNum(hash.talktime),
        completed: this.toNum(hash.completed),
        abandoned: this.toNum(hash.abandoned),
        longestWait: this.toNum(hash.longestWait),
        membersTotal: this.toNum(hash.membersTotal),
        membersAvailable: this.toNum(hash.membersAvailable),
        updatedAt: hash.updatedAt || '',
      });
    }
    return results.sort((a, b) => a.queue.localeCompare(b.queue));
  }

  async getCalls(user: AuthenticatedUser): Promise<ActiveCallView[]> {
    const ids = await this.redis.client.smembers(KEYS.activeCallIndex());
    const ext = this.isAdmin(user) ? null : user.extension;

    const results: ActiveCallView[] = [];
    for (const id of ids) {
      const hash = await this.redis.client.hgetall(KEYS.activeCall(id));
      if (!hash || Object.keys(hash).length === 0) continue;
      if (ext !== null && hash.extension !== ext) continue;
      results.push({
        uniqueid: hash.uniqueid || id,
        linkedid: hash.linkedid || '',
        channel: hash.channel || '',
        extension: hash.extension || '',
        state: hash.state || '',
        callerNum: hash.callerNum || '',
        callerName: hash.callerName || '',
        connectedNum: hash.connectedNum || '',
        updatedAt: hash.updatedAt || '',
      });
    }
    return results;
  }

  async getParked(): Promise<ParkedCallView[]> {
    const slots = await this.redis.client.smembers(KEYS.parkIndex());
    const results: ParkedCallView[] = [];
    for (const slot of slots) {
      const hash = await this.redis.client.hgetall(KEYS.parkedCall(slot));
      if (!hash || Object.keys(hash).length === 0) continue;
      results.push({
        slot: hash.slot || slot,
        channel: hash.channel || '',
        callerNum: hash.callerNum || '',
        callerName: hash.callerName || '',
        parkerDialString: hash.parkerDialString || '',
        parkedAt: hash.parkedAt || '',
      });
    }
    return results.sort((a, b) => a.slot.localeCompare(b.slot));
  }

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummary> {
    this.assertAdmin(user);

    const activeCalls = await this.redis.client.scard(KEYS.activeCallIndex());

    // Agents online = presence present and not offline.
    const extensions = await this.redis.client.smembers(KEYS.agentIndex());
    let agentsOnline = 0;
    for (const ext of extensions) {
      const endpoint = await this.redis.client.hgetall(KEYS.endpointState(ext));
      const presence = endpoint?.presence;
      if (presence && presence !== AgentPresence.OFFLINE) agentsOnline += 1;
    }

    // Callers waiting + longest wait, summed across queue snapshots.
    const names = await this.redis.client.smembers(KEYS.queueIndex());
    let callsInQueue = 0;
    let longestWait = 0;
    for (const name of names) {
      const hash = await this.redis.client.hgetall(KEYS.queueSnapshot(name));
      if (!hash || Object.keys(hash).length === 0) continue;
      callsInQueue += this.toNum(hash.calls);
      longestWait = Math.max(longestWait, this.toNum(hash.longestWait));
    }

    return { activeCalls, agentsOnline, callsInQueue, longestWait };
  }
}
