import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  BlacklistDirection,
  IvrDestinationType,
  MiscDestinationType,
  QueueStrategy,
  RecordingScope,
  TrunkAuthType,
  UserRole,
} from '../../common/enums';

/** Application user (admin or agent). Agents own exactly one extension. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  username: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash: string;

  /** Bcrypt hash of the currently-valid refresh token (rotated on each refresh). */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refreshTokenHash: string | null;

  /** Whether TOTP two-factor auth is active for this account. */
  @Column({ type: 'boolean', default: false })
  twoFactorEnabled: boolean;

  /** Base32 TOTP shared secret. Never selected by default. */
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  twoFactorSecret: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.AGENT })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Extension id (ps_endpoints.id) assigned to this user, if any. */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  extension: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * App-level metadata for an extension. The PJSIP realtime rows (ps_endpoints/
 * ps_auths/ps_aors) are the Asterisk contract; this row carries UI/business
 * fields and is kept in sync by ExtensionsService.
 */
@Entity('extensions')
export class Extension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Matches ps_endpoints.id / ps_auths.id / ps_aors.id. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  extensionNumber: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  department: string | null;

  @Column({ type: 'boolean', default: false })
  webrtc: boolean;

  @Column({ type: 'boolean', default: false })
  recordingEnabled: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  callGroup: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  pickupGroup: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** SIP trunk to a provider/PSTN. Backing PJSIP rows created by TrunksService. */
@Entity('trunks')
export class Trunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  name: string;

  @Column({ type: 'enum', enum: TrunkAuthType, default: TrunkAuthType.REGISTRATION })
  authType: TrunkAuthType;

  @Column({ type: 'varchar', length: 255 })
  sipServer: string;

  @Column({ type: 'int', default: 5060 })
  sipPort: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, select: false })
  password: string | null;

  /** For IP-auth trunks: source IP/CIDR to match. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  matchIp: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  codecs: string | null;

  @Column({ type: 'int', default: 0 })
  failoverOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** Outbound routing rule: which trunk handles a dialed pattern. */
@Entity('outbound_routes')
export class OutboundRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** Dial pattern, e.g. `_9NXXXXXXXXX` or a regex-like prefix. */
  @Column({ type: 'varchar', length: 120 })
  pattern: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  prefix: string | null;

  /** Digits to strip from the front before sending to the trunk. */
  @Column({ type: 'int', default: 0 })
  stripDigits: number;

  /** Prepend caller id override for this route, optional. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  callerIdOverride: string | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  /** Ordered trunk ids to try (failover). Stored as JSON array of trunk ids. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  trunkIds: string[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** Blocked numbers, enforced by the telephony module at call-start. */
@Entity('blacklist')
export class BlacklistEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ type: 'enum', enum: BlacklistDirection, default: BlacklistDirection.BOTH })
  direction: BlacklistDirection;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** Recording metadata; audio file lives on disk (RECORDING_DIR). */
@Entity('recordings')
export class Recording {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  uniqueid: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  linkedid: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  src: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  dst: string | null;

  @Column({ type: 'enum', enum: RecordingScope, default: RecordingScope.GLOBAL })
  scope: RecordingScope;

  @Column({ type: 'varchar', length: 512 })
  filePath: string;

  @Column({ type: 'varchar', length: 16, default: 'wav' })
  format: string;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: string | null;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;

  @Column({ type: 'boolean', default: false })
  archived: boolean;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** Per-extension call forwarding target. */
@Entity('call_forwarding')
export class CallForwarding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  extensionNumber: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 80, nullable: true })
  forwardTo: string | null;

  /** unconditional | busy | noanswer */
  @Column({ type: 'varchar', length: 20, default: 'unconditional' })
  forwardType: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** Misc destination — external number / announcement / hangup. */
@Entity('misc_destinations')
export class MiscDestination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'enum', enum: MiscDestinationType })
  type: MiscDestinationType;

  /** External number to dial, or announcement sound file, depending on type. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  value: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** Music-on-hold class. Files referenced by path on VM1. */
@Entity('moh_classes')
export class MohClass {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'files' })
  mode: string;

  @Column({ type: 'varchar', length: 512 })
  directory: string;

  @Column({ type: 'varchar', length: 20, default: 'wav' })
  format: string;

  @OneToMany(() => MohFile, (f) => f.mohClass)
  files: MohFile[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('moh_files')
export class MohFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MohClass, (c) => c.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mohClassId' })
  mohClass: MohClass;

  @Column({ type: 'uuid' })
  mohClassId: string;

  @Column({ type: 'varchar', length: 200 })
  fileName: string;

  @Column({ type: 'varchar', length: 512 })
  filePath: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** IVR menu. Executed live by the telephony module's ARI Stasis logic. */
@Entity('ivr_menus')
export class IvrMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 200 })
  greetingSound: string;

  @Column({ type: 'int', default: 5 })
  digitTimeoutSec: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  /** Destination when caller presses nothing / invalid after retries. */
  @Column({ type: 'enum', enum: IvrDestinationType, default: IvrDestinationType.HANGUP })
  invalidDestType: IvrDestinationType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  invalidDestValue: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => IvrEntry, (e) => e.menu, { cascade: true })
  entries: IvrEntry[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** A single DTMF option within an IVR menu. */
@Entity('ivr_entries')
export class IvrEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => IvrMenu, (m) => m.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuId' })
  menu: IvrMenu;

  @Column({ type: 'uuid' })
  menuId: string;

  /** DTMF digit(s) that trigger this entry, e.g. "1", "0", "#". */
  @Column({ type: 'varchar', length: 8 })
  digit: string;

  @Column({ type: 'enum', enum: IvrDestinationType })
  destType: IvrDestinationType;

  @Column({ type: 'varchar', length: 120, nullable: true })
  destValue: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  label: string | null;
}

/** App-level queue metadata paired with the realtime `queues` row. */
@Entity('queue_config')
export class QueueConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  @Column({ type: 'enum', enum: QueueStrategy, default: QueueStrategy.RRMEMORY })
  strategy: QueueStrategy;

  @Column({ type: 'varchar', length: 80, default: 'default' })
  mohClass: string;

  @Column({ type: 'int', default: 15 })
  timeout: number;

  @Column({ type: 'int', default: 0 })
  wrapupTime: number;

  @Column({ type: 'int', nullable: true })
  maxWait: number | null;

  /** Overflow/timeout destination type + value (e.g. misc dest / voicemail). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  overflowDestType: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  overflowDestValue: string | null;

  @Column({ type: 'boolean', default: false })
  recordingEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** ConfBridge conference room. Live participants tracked in Redis. */
@Entity('conferences')
export class Conference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  roomNumber: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, nullable: true, select: false })
  pin: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, select: false })
  adminPin: string | null;

  @Column({ type: 'boolean', default: true })
  recordingEnabled: boolean;

  @Column({ type: 'varchar', length: 80, default: 'default' })
  mohClass: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
