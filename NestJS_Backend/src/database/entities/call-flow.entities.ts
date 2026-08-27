import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Ring group (Module 2). A virtual number that rings several extensions
 * (simultaneously or in sequence), then falls through to a destination on no
 * answer. Executed by the ARI Stasis handler (like IVR) — this row is the
 * config the handler reads.
 */
@Entity('ring_groups')
export class RingGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The virtual number callers dial to reach the group. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** RingGroupStrategy — ringall | hunt | memoryhunt. */
  @Column({ type: 'varchar', length: 20, default: 'ringall' })
  strategy: string;

  /** Member extension numbers, in ring order. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  memberExtensions: string[];

  /** Seconds to ring before giving up (per member for hunt, total for ringall). */
  @Column({ type: 'int', default: 20 })
  ringTimeSec: number;

  /** Destination when nobody answers (RouteDestinationType). */
  @Column({ type: 'varchar', length: 40, default: 'hangup' })
  noAnswerDestType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  noAnswerDestValue: string | null;

  /** Optional prefix prepended to caller id so agents see it came via the group. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  callerIdPrefix: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Queue callback request (Module 2). Stores a caller's request to be called
 * back instead of holding. The caller-facing "press 1 for callback" prompt is a
 * Stasis/queue interaction that creates these rows; this module also lets staff
 * list/dial/cancel them.
 */
@Entity('queue_callbacks')
@Index(['queueName', 'status'])
export class QueueCallback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  callerName: string | null;

  /** Higher dials first. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  /** CallbackStatus — pending | dialing | done | cancelled | failed. */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastAttemptAt: Date | null;

  /** AMI actionId of the most recent originate. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  lastUniqueid: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
