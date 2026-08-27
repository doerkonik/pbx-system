import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import AmiClient from 'asterisk-ami-client';
import { AmiConfig } from '../config/configuration';

export interface AmiActionResponse {
  Response?: string;
  Message?: string;
  ActionID?: string;
  [key: string]: any;
}

/**
 * Persistent AMI connection with self-managed exponential-backoff reconnect.
 * Emits:
 *   - 'event'  (raw AMI event object) — consumed by TelephonyService
 *   - 'state'  ('connected' | 'disconnected' | 'connecting')
 * Never throws into the process on a drop; a lost connection just triggers the
 * reconnect loop while queued actions reject with a clear error.
 */
@Injectable()
export class AmiService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AmiService.name);
  private client: any;
  private cfg!: AmiConfig;
  private connected = false;
  private shuttingDown = false;
  private attempt = 0;
  private actionSeq = 0;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit(): void {
    this.cfg = this.config.get<AmiConfig>('ami')!;
    void this.connect();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async connect(): Promise<void> {
    if (this.shuttingDown) return;
    this.emit('state', 'connecting');

    // Manage reconnection ourselves for consistent backoff + state events.
    this.client = new (AmiClient as any)({
      reconnect: false,
      keepAlive: true,
      emitEventsByTypes: false,
      emitResponsesById: false,
    });

    this.wireEvents();

    try {
      await this.client.connect(this.cfg.username, this.cfg.password, {
        host: this.cfg.host,
        port: this.cfg.port,
      });
      this.connected = true;
      this.attempt = 0;
      this.logger.log(`AMI connected to ${this.cfg.host}:${this.cfg.port}`);
      this.emit('state', 'connected');
    } catch (err) {
      this.logger.error(`AMI connect failed: ${(err as Error).message}`);
      this.scheduleReconnect();
    }
  }

  private wireEvents(): void {
    this.client.removeAllListeners?.();

    this.client.on('event', (event: Record<string, any>) => {
      this.emit('event', event);
    });

    this.client.on('disconnect', () => {
      if (!this.connected) return;
      this.connected = false;
      this.logger.warn('AMI disconnected');
      this.emit('state', 'disconnected');
      this.scheduleReconnect();
    });

    this.client.on('internalError', (err: Error) => {
      this.logger.error(`AMI internal error: ${err.message}`);
      if (this.connected) {
        this.connected = false;
        this.emit('state', 'disconnected');
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown) return;
    this.attempt += 1;
    const delay = Math.min(
      this.cfg.reconnectBaseMs * 2 ** (this.attempt - 1),
      this.cfg.reconnectMaxMs,
    );
    this.logger.warn(
      `AMI reconnect attempt ${this.attempt} in ${delay}ms`,
    );
    try {
      this.client?.disconnect?.();
    } catch {
      /* ignore */
    }
    setTimeout(() => void this.connect(), delay);
  }

  /**
   * Send an AMI action and resolve with the correlated Response.
   * Correlated by a generated ActionID so concurrent actions don't cross wires.
   */
  action(
    message: Record<string, any>,
    timeoutMs = 8000,
  ): Promise<AmiActionResponse> {
    if (!this.connected) {
      return Promise.reject(new Error('AMI not connected'));
    }
    // Preserve a caller-provided ActionID (multi-event actions correlate their
    // burst of events on it); otherwise generate a unique one.
    const actionId =
      (message.ActionID as string) ?? `pbx-${Date.now()}-${++this.actionSeq}`;
    const payload = { ...message, ActionID: actionId };

    return new Promise<AmiActionResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.removeListener('response', onResponse);
        reject(new Error(`AMI action ${message.Action} timed out`));
      }, timeoutMs);

      const onResponse = (res: AmiActionResponse) => {
        if (res.ActionID !== actionId) return;
        clearTimeout(timer);
        this.client.removeListener('response', onResponse);
        if (res.Response === 'Error') {
          reject(new Error(res.Message ?? `AMI action ${message.Action} failed`));
        } else {
          resolve(res);
        }
      };

      this.client.on('response', onResponse);
      try {
        this.client.action(payload);
      } catch (err) {
        clearTimeout(timer);
        this.client.removeListener('response', onResponse);
        reject(err);
      }
    });
  }

  onModuleDestroy(): void {
    this.shuttingDown = true;
    try {
      this.client?.disconnect?.();
    } catch {
      /* ignore */
    }
  }
}
