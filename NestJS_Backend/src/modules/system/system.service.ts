import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import * as os from 'os';
import * as fsp from 'fs/promises';
import { RedisService } from '../../redis/redis.service';
import { KEYS } from '../../redis/redis.constants';
import { TelephonyService } from '../../telephony/telephony.service';
import { AgentPresence } from '../../common/enums';

export interface ServerStatus {
  hostname: string;
  platform: string;
  arch: string;
  osUptimeSec: number;
  processUptimeSec: number;
  cpu: {
    cores: number;
    loadAvg: [number, number, number];
    usagePct: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPct: number;
  };
  disk: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPct: number;
  } | null;
}

/**
 * Infrastructure monitoring (Module 11): host resource stats (Node os/fs),
 * live telephony/SIP status (from Redis + AMI/ARI health), and a safe ping
 * diagnostic. No persistence — everything is queried on demand.
 */
@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly telephony: TelephonyService,
  ) {}

  async serverStatus(diskPath = '/'): Promise<ServerStatus> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      osUptimeSec: Math.floor(os.uptime()),
      processUptimeSec: Math.floor(process.uptime()),
      cpu: {
        cores: os.cpus().length,
        loadAvg: os.loadavg() as [number, number, number],
        usagePct: await this.cpuUsagePct(),
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: usedMem,
        usedPct: totalMem ? Math.round((usedMem / totalMem) * 100) : 0,
      },
      disk: await this.diskUsage(diskPath),
    };
  }

  /** Live telephony/SIP overview for the ops dashboard. */
  async telephonyStatus(): Promise<Record<string, unknown>> {
    const connection = this.telephony.getConnectionState();
    const activeCalls = await this.redis.client.scard(KEYS.activeCallIndex());

    const extensions = await this.redis.client.smembers(KEYS.agentIndex());
    let endpointsOnline = 0;
    for (const ext of extensions) {
      const presence = await this.redis.client.hget(
        KEYS.endpointState(ext),
        'presence',
      );
      if (presence && presence !== AgentPresence.OFFLINE) endpointsOnline += 1;
    }

    let trunks: Record<string, string> = {};
    try {
      trunks = await this.telephony.getOutboundRegistrations();
    } catch {
      /* AMI may be down; leave trunks empty */
    }

    return {
      connection,
      activeCalls,
      endpointsKnown: extensions.length,
      endpointsOnline,
      trunks,
    };
  }

  /** Compact active-call list from Redis live state. */
  async activeChannels(): Promise<Record<string, string>[]> {
    const ids = await this.redis.client.smembers(KEYS.activeCallIndex());
    const out: Record<string, string>[] = [];
    for (const id of ids) {
      const hash = await this.redis.client.hgetall(KEYS.activeCall(id));
      if (hash && Object.keys(hash).length > 0) out.push(hash);
    }
    return out;
  }

  /** Safe ICMP ping (no shell; strict host validation). */
  ping(host: string): Promise<{ host: string; reachable: boolean; output: string }> {
    if (!/^[A-Za-z0-9]([A-Za-z0-9.\-]{0,253})$/.test(host)) {
      return Promise.resolve({
        host,
        reachable: false,
        output: 'Invalid host',
      });
    }
    return new Promise((resolve) => {
      execFile(
        'ping',
        ['-c', '3', '-W', '2', host],
        { timeout: 10_000 },
        (err, stdout, stderr) => {
          resolve({
            host,
            reachable: !err,
            output: (stdout || stderr || '').slice(0, 4000),
          });
        },
      );
    });
  }

  /* ------------------------------ internals ---------------------------- */

  /** Sample CPU times ~150ms apart and return busy percentage. */
  private async cpuUsagePct(): Promise<number> {
    const sample = () => {
      let idle = 0;
      let total = 0;
      for (const cpu of os.cpus()) {
        for (const t of Object.values(cpu.times)) total += t;
        idle += cpu.times.idle;
      }
      return { idle, total };
    };
    const a = sample();
    await new Promise((r) => setTimeout(r, 150));
    const b = sample();
    const idleDelta = b.idle - a.idle;
    const totalDelta = b.total - a.total;
    if (totalDelta <= 0) return 0;
    return Math.round((1 - idleDelta / totalDelta) * 100);
  }

  private async diskUsage(path: string): Promise<ServerStatus['disk']> {
    try {
      const statfs = (fsp as unknown as { statfs?: Function }).statfs;
      if (typeof statfs !== 'function') return null;
      const s: any = await statfs(path);
      const totalBytes = s.blocks * s.bsize;
      const freeBytes = s.bavail * s.bsize;
      const usedBytes = totalBytes - freeBytes;
      return {
        path,
        totalBytes,
        freeBytes,
        usedBytes,
        usedPct: totalBytes ? Math.round((usedBytes / totalBytes) * 100) : 0,
      };
    } catch (err) {
      this.logger.warn(`Disk stat failed for ${path}: ${(err as Error).message}`);
      return null;
    }
  }
}
