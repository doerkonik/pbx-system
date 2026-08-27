import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AriService } from './ari.service';
import { IvrEntry, IvrMenu } from '../database/entities';
import { IvrDestinationType } from '../common/enums';

/**
 * Executes IVR menus live over ARI (no static dialplan menus). When a channel
 * enters Stasis with appArgs "ivr,<menuName>", we answer it, play the greeting,
 * collect a DTMF digit, and route per the menu's configured entries.
 *
 * Final routing hands the channel back to a thin dialplan context (from-ivr)
 * for the actual ring/queue-join leg — the menu *logic* stays in ARI.
 */
@Injectable()
export class IvrRunnerService implements OnModuleInit {
  private readonly logger = new Logger(IvrRunnerService.name);
  /** Per-channel collected digit + retry bookkeeping. */
  private sessions = new Map<string, { menu: IvrMenu; retries: number }>();

  constructor(
    private readonly ari: AriService,
    @InjectRepository(IvrMenu)
    private readonly menuRepo: Repository<IvrMenu>,
  ) {}

  onModuleInit(): void {
    this.ari.on('stasisStart', (event: any, channel: any) => {
      const args: string[] = event?.args ?? [];
      if (args[0] === 'ivr' && args[1]) {
        void this.runMenu(channel, args[1]);
      }
    });
  }

  private async runMenu(channel: any, menuName: string): Promise<void> {
    try {
      const menu = await this.menuRepo.findOne({
        where: { name: menuName, isActive: true },
        relations: ['entries'],
      });
      if (!menu) {
        this.logger.warn(`IVR menu ${menuName} not found; hanging up`);
        await channel.hangup().catch(() => undefined);
        return;
      }
      await channel.answer();
      this.sessions.set(channel.id, { menu, retries: 0 });
      await this.promptAndCollect(channel);
    } catch (err) {
      this.logger.error(`IVR run failed: ${(err as Error).message}`);
      await channel.hangup().catch(() => undefined);
    }
  }

  private async promptAndCollect(channel: any): Promise<void> {
    const session = this.sessions.get(channel.id);
    if (!session) return;
    const client = this.ari.getClient();

    // Play greeting; DTMF during playback is captured by the handler below.
    const playback = client.Playback();
    let collected = '';
    let settled = false;

    const cleanup = () => {
      channel.removeListener('ChannelDtmfReceived', onDtmf);
    };

    const finish = async (digit: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      await this.route(channel, session, digit);
    };

    const onDtmf = (evt: any) => {
      collected = evt.digit;
      void playback.stop?.().catch(() => undefined);
      void finish(collected);
    };

    channel.on('ChannelDtmfReceived', onDtmf);

    try {
      await channel.play(
        { media: `sound:${session.menu.greetingSound}` },
        playback,
      );
    } catch {
      /* greeting missing — still allow input */
    }

    // Inter-digit timeout after greeting.
    setTimeout(() => {
      if (!settled) void finish('');
    }, session.menu.digitTimeoutSec * 1000);
  }

  private async route(
    channel: any,
    session: { menu: IvrMenu; retries: number },
    digit: string,
  ): Promise<void> {
    const entry: IvrEntry | undefined = session.menu.entries?.find(
      (e) => e.digit === digit,
    );

    if (!entry) {
      // No / invalid input: retry or fall through to invalid destination.
      if (session.retries + 1 < session.menu.maxRetries) {
        session.retries += 1;
        this.sessions.set(channel.id, session);
        await this.promptAndCollect(channel);
        return;
      }
      await this.dispatch(
        channel,
        session.menu.invalidDestType,
        session.menu.invalidDestValue,
      );
      return;
    }

    await this.dispatch(channel, entry.destType, entry.destValue);
  }

  private async dispatch(
    channel: any,
    type: IvrDestinationType,
    value: string | null,
  ): Promise<void> {
    this.sessions.delete(channel.id);
    try {
      switch (type) {
        case IvrDestinationType.HANGUP:
          await channel.hangup();
          return;
        case IvrDestinationType.EXTENSION:
          await channel.continueInDialplan({
            context: 'from-ivr',
            extension: value ?? 's',
            priority: 1,
          });
          return;
        case IvrDestinationType.QUEUE:
          await channel.continueInDialplan({
            context: 'from-ivr-queue',
            extension: value ?? 's',
            priority: 1,
          });
          return;
        case IvrDestinationType.IVR:
          // Re-enter Stasis routing into another menu.
          if (value) await this.runMenu(channel, value);
          else await channel.hangup();
          return;
        case IvrDestinationType.MISC_DESTINATION:
        case IvrDestinationType.VOICEMAIL:
          await channel.continueInDialplan({
            context: 'from-ivr-misc',
            extension: value ?? 's',
            priority: 1,
          });
          return;
        default:
          await channel.hangup();
      }
    } catch (err) {
      this.logger.error(`IVR dispatch failed: ${(err as Error).message}`);
      await channel.hangup().catch(() => undefined);
    }
  }
}
