import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../config/configuration';

/**
 * Owns three ioredis connections:
 *  - `client`     : general commands (get/set/hset/expire/...)
 *  - `publisher`  : pub-only (telephony module publishes normalized events)
 *  - `subscriber` : sub-only (WS gateway / subscriber service consume)
 *
 * A connection in subscribe mode cannot run normal commands, hence the split.
 * All three auto-reconnect (ioredis built-in). Failures are logged, never thrown
 * into the event loop as unhandled rejections.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client!: Redis;
  public publisher!: Redis;
  public subscriber!: Redis;

  // Connections are created in the constructor (not onModuleInit) so they exist
  // before any consumer's onModuleInit runs, regardless of module init order.
  constructor(private readonly config: ConfigService) {
    const cfg = this.config.get<RedisConfig>('redis')!;
    const base = {
      host: cfg.host,
      port: cfg.port,
      password: cfg.password || undefined,
      db: cfg.db,
      keyPrefix: cfg.keyPrefix,
      // Retry forever with capped backoff so a Redis blip never kills the app.
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
      maxRetriesPerRequest: null as unknown as number,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    this.client = new Redis(base);
    this.publisher = new Redis(base);
    // Subscriber must NOT use keyPrefix — channel names are global.
    this.subscriber = new Redis({ ...base, keyPrefix: undefined });

    for (const [name, conn] of [
      ['client', this.client],
      ['publisher', this.publisher],
      ['subscriber', this.subscriber],
    ] as const) {
      conn.on('error', (err) =>
        this.logger.error(`Redis[${name}] error: ${err.message}`),
      );
      conn.on('connect', () => this.logger.log(`Redis[${name}] connected`));
      conn.on('reconnecting', () =>
        this.logger.warn(`Redis[${name}] reconnecting...`),
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify(payload));
    } catch (err) {
      this.logger.error(
        `Failed to publish to ${channel}: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.client?.quit(),
      this.publisher?.quit(),
      this.subscriber?.quit(),
    ]);
  }
}
