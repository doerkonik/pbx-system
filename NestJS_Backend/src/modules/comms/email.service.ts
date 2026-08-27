import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SmtpConfig } from '../../config/configuration';

/**
 * SMTP email delivery (Module 12). Disabled by default (SMTP_ENABLED=false):
 * when off, sends are logged and skipped so the rest of the system works
 * without a mail server. Configure via SMTP_* env vars to enable.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private cfg!: SmtpConfig;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.cfg = this.config.get<SmtpConfig>('smtp')!;
    if (!this.cfg.enabled) {
      this.logger.log('SMTP disabled (SMTP_ENABLED=false) — emails are logged only');
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: this.cfg.user ? { user: this.cfg.user, pass: this.cfg.pass } : undefined,
    });
    this.logger.log(`SMTP configured for ${this.cfg.host}:${this.cfg.port}`);
  }

  get enabled(): boolean {
    return !!this.transporter;
  }

  /** Send an email. Best-effort: logs and returns false on failure/disabled. */
  async send(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug(`(skipped) email to ${params.to}: ${params.subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: this.cfg.from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Email to ${params.to} failed: ${(err as Error).message}`);
      return false;
    }
  }
}
