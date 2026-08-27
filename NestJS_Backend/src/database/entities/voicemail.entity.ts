import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Asterisk `app_voicemail` realtime table (family `voicemail`). Asterisk reads
 * mailboxes live from here via res_config_pgsql — column names MUST match
 * app_voicemail's realtime expectations (all lowercase), so do not rename.
 * See asterisk_configuration.md for the matching extconfig.conf/voicemail.conf.
 *
 * voicemail-to-email is driven by `email` + `attach='yes'`; Asterisk sends the
 * message using its own configured mailer (voicemail.conf [general]).
 */
@Entity('voicemail')
@Index(['context', 'mailbox'], { unique: true })
export class VoicemailBox {
  @PrimaryGeneratedColumn()
  uniqueid: number;

  @Column({ type: 'varchar', length: 80, default: 'default' })
  context: string;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  mailbox: string;

  /** Numeric voicemail PIN. Hidden from API responses; Asterisk reads it directly. */
  @Column({ type: 'varchar', length: 80, select: false })
  password: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fullname: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  pager: string | null;

  /** 'yes' attaches the recording to the notification email. */
  @Column({ type: 'varchar', length: 5, default: 'no' })
  attach: string;

  @Column({ type: 'varchar', length: 10, nullable: true, default: 'wav' })
  attachfmt: string | null;

  /** 1 = delete the message after emailing it (email-only mailbox). */
  @Column({ type: 'int', default: 0 })
  deletevoicemail: number;

  @Column({ type: 'varchar', length: 5, default: 'no' })
  saycid: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tz: string | null;

  @Column({ type: 'int', nullable: true, default: 100 })
  maxmsg: number | null;
}
