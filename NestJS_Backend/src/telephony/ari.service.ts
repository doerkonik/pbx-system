import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as ari from 'ari-client';
import { AriConfig } from '../config/configuration';

/** ARI event types we forward to the normalizer / IVR runner. */
const FORWARDED_EVENTS = [
  'StasisStart',
  'StasisEnd',
  'ChannelStateChange',
  'ChannelHold',
  'ChannelUnhold',
  'ChannelDtmfReceived',
  'ChannelHangupRequest',
  'ChannelDestroyed',
  'ChannelEnteredBridge',
  'ChannelLeftBridge',
] as const;

/**
 * Persistent ARI Stasis-app connection with self-managed backoff reconnect.
 * Exposes the raw ari-client (`client`) for call-control operations and emits:
 *   - 'event'       (raw ARI event) for normalization
 *   - 'stasisStart' (event, channel) for the IVR runner
 *   - 'state'       connection state
 */
@Injectable()
export class AriService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AriService.name);
  public client: any = null;
  private cfg!: AriConfig;
  private connected = false;
  private shuttingDown = false;
  private attempt = 0;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    this.cfg = this.config.get<AriConfig>('ari')!;
    void this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): any {
    if (!this.connected || !this.client) {
      throw new Error('ARI not connected');
    }
    return this.client;
  }

  private async connect(): Promise<void> {
    if (this.shuttingDown) return;
    this.emit('state', 'connecting');
    try {
      this.client = await ari.connect(
        this.cfg.url,
        this.cfg.username,
        this.cfg.password,
      );

      for (const type of FORWARDED_EVENTS) {
        this.client.on(type, (event: any, channel: any) => {
          this.emit('event', event);
          if (type === 'StasisStart') this.emit('stasisStart', event, channel);
        });
      }

      this.client.on('WebSocketError', (err: Error) => {
        this.logger.error(`ARI WebSocket error: ${err?.message ?? err}`);
      });
      this.client.on('WebSocketClose', () => {
        if (!this.connected) return;
        this.connected = false;
        this.logger.warn('ARI WebSocket closed');
        this.emit('state', 'disconnected');
        this.scheduleReconnect();
      });

      await this.client.start(this.cfg.appName);
      this.connected = true;
      this.attempt = 0;
      this.logger.log(
        `ARI connected to ${this.cfg.url} (app: ${this.cfg.appName})`,
      );
      this.emit('state', 'connected');
    } catch (err) {
      this.logger.error(`ARI connect failed: ${(err as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown) return;
    this.attempt += 1;
    const delay = Math.min(
      this.cfg.reconnectBaseMs * 2 ** (this.attempt - 1),
      this.cfg.reconnectMaxMs,
    );
    this.logger.warn(`ARI reconnect attempt ${this.attempt} in ${delay}ms`);
    setTimeout(() => void this.connect(), delay);
  }

  onModuleDestroy(): void {
    this.shuttingDown = true;
    try {
      this.client?.stop?.();
    } catch {
      /* ignore */
    }
  }
}
