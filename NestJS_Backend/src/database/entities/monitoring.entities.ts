import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Supervisor & monitoring config/state (Module 6).
 *
 * `SlaThreshold` holds per-queue live thresholds the SLA evaluator checks every
 * few seconds against the Redis queue snapshots. `MonitoringAlert` is the log of
 * breaches (open until the metric recovers), also pushed live to staff.
 */
@Entity('sla_thresholds')
export class SlaThreshold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  /** Alert when the longest current wait exceeds this (seconds). */
  @Column({ type: 'int', default: 60 })
  maxWaitSec: number;

  /** Alert when callers waiting exceeds this. */
  @Column({ type: 'int', default: 10 })
  maxCallsWaiting: number;

  /** Alert when available agents drop below this while calls are waiting. */
  @Column({ type: 'int', default: 1 })
  minAvailableAgents: number;

  /** Target answer-within threshold (seconds) used for service-level reporting. */
  @Column({ type: 'int', default: 20 })
  serviceLevelTargetSec: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('monitoring_alerts')
export class MonitoringAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  /** wait_exceeded | backlog | no_agents */
  @Column({ type: 'varchar', length: 40 })
  type: string;

  /** warning | critical */
  @Column({ type: 'varchar', length: 20, default: 'warning' })
  severity: string;

  @Column({ type: 'varchar', length: 200 })
  message: string;

  @Column({ type: 'int', default: 0 })
  value: number;

  @Column({ type: 'int', default: 0 })
  threshold: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  /** Set when the breach clears; NULL = still open. */
  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
