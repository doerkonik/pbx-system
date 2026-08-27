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

/**
 * Inbound telephony routing (Module 1 — Telephony Core).
 *
 * Design notes:
 *  - DIDs are pure inventory (which numbers we own, on which trunk). Routing
 *    rules live in `inbound_routes` and match by DID number, mirroring the
 *    FreePBX "DIDs vs Inbound Routes" split.
 *  - Destination types are stored as plain varchar and validated at the DTO
 *    layer with `RouteDestinationType` (same precedent as
 *    CallForwarding.forwardType) — this keeps routing targets easy to extend
 *    without an ALTER TYPE on every new channel.
 *  - `destValue` is a soft reference (extension number / queue name / ivr id /
 *    time-condition id) resolved at call time, exactly like IvrEntry.destValue.
 *  - Time evaluation is done in Node at Stasis entry (not baked into dialplan)
 *    so edits apply instantly with no reload.
 */

/** A phone number (DID) the system owns, optionally bound to an arrival trunk. */
@Entity('dids')
export class Did {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The DID as presented by the provider (E.164 or provider format). */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  number: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  /** Trunk (trunks.id) this DID arrives on, if pinned to a specific provider. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  trunkId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * Inbound routing rule. Matched by DID number (null = catch-all) plus optional
 * caller-id pattern; picks a destination with an optional fallback.
 */
@Entity('inbound_routes')
export class InboundRoute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** DID number to match. NULL matches any DID (catch-all / default route). */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  didNumber: string | null;

  /** Optional caller-id pattern to match (exact or Asterisk-style _X. pattern). */
  @Column({ type: 'varchar', length: 80, nullable: true })
  cidPattern: string | null;

  /** RouteDestinationType. */
  @Column({ type: 'varchar', length: 40 })
  destType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  destValue: string | null;

  /** Fallback destination if the primary is unavailable (RouteDestinationType). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  fallbackDestType: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  fallbackDestValue: string | null;

  /** Higher priority wins when multiple rules match. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/** A named set of time ranges (business hours) referenced by time conditions. */
@Entity('time_groups')
export class TimeGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @OneToMany(() => TimeGroupRange, (r) => r.timeGroup, { cascade: true })
  ranges: TimeGroupRange[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/**
 * One matching window within a TimeGroup. Any NULL bound means "any" for that
 * dimension, so a simple Mon–Fri 09:00–17:00 range sets only weekday + time.
 */
@Entity('time_group_ranges')
export class TimeGroupRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => TimeGroup, (g) => g.ranges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timeGroupId' })
  timeGroup: TimeGroup;

  @Index()
  @Column({ type: 'uuid' })
  timeGroupId: string;

  /** Weekday range 0=Sunday..6=Saturday; NULL = any day. */
  @Column({ type: 'int', nullable: true })
  weekdayStart: number | null;

  @Column({ type: 'int', nullable: true })
  weekdayEnd: number | null;

  /** Time-of-day 'HH:mm' (24h); NULL = any time. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  timeStart: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  timeEnd: string | null;

  /** Day-of-month 1..31; NULL = any. */
  @Column({ type: 'int', nullable: true })
  monthDayStart: number | null;

  @Column({ type: 'int', nullable: true })
  monthDayEnd: number | null;

  /** Month 1..12; NULL = any. */
  @Column({ type: 'int', nullable: true })
  monthStart: number | null;

  @Column({ type: 'int', nullable: true })
  monthEnd: number | null;
}

/**
 * Time condition: if "now" falls inside the referenced TimeGroup, route to the
 * match destination, otherwise the no-match destination. Referenced by inbound
 * routes (destType=time_condition) to build business-hours routing.
 */
@Entity('time_conditions')
export class TimeCondition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @ManyToOne(() => TimeGroup, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'timeGroupId' })
  timeGroup: TimeGroup;

  @Index()
  @Column({ type: 'uuid' })
  timeGroupId: string;

  /** Destination when current time is inside the group (RouteDestinationType). */
  @Column({ type: 'varchar', length: 40 })
  matchDestType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  matchDestValue: string | null;

  /** Destination when outside the group (RouteDestinationType). */
  @Column({ type: 'varchar', length: 40 })
  noMatchDestType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  noMatchDestValue: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * A holiday date that overrides normal routing to a holiday destination.
 * `recurring` matches month/day every year (ignores the year component).
 */
@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Index()
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'boolean', default: false })
  recurring: boolean;

  /** RouteDestinationType to send calls to on this holiday. */
  @Column({ type: 'varchar', length: 40 })
  destType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  destValue: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
