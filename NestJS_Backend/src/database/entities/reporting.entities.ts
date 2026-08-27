import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AgentPresence } from '../../common/enums';

/**
 * Dual-write target for breaks/pause. One open row (ended_at NULL) per active
 * pause; closed when the agent resumes. Asterisk does not track break reasons,
 * so this table is the source of truth for break-reason reporting.
 */
@Entity('agent_status_log')
@Index(['agentId', 'startedAt'])
export class AgentStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 40 })
  extension: string;

  @Column({ type: 'enum', enum: AgentPresence })
  status: AgentPresence;

  /** Configured break-reason code (see break_reasons.code). Free-form varchar. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  reason: string | null;

  @Index()
  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;
}

/** Agent login/logout sessions — distinct from queue pause state. */
@Entity('agent_sessions')
@Index(['agentId', 'loginAt'])
export class AgentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  agentId: string;

  /** The agent's home extension identity. */
  @Column({ type: 'varchar', length: 40 })
  extension: string;

  /**
   * Physical device the agent logged into for this session (hot-desking). Equals
   * `extension` for a normal login; differs when the agent hot-desks onto
   * another station.
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  deviceExtension: string | null;

  @Column({ type: 'timestamptz' })
  loginAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  logoutAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSec: number | null;
}

/** Nightly rollup: one row per agent per day. Powers week/month/year reports. */
@Entity('daily_agent_stats')
@Unique(['statDate', 'agentId'])
export class DailyAgentStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'date' })
  statDate: string;

  @Index()
  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 40 })
  extension: string;

  @Column({ type: 'int', default: 0 })
  callsHandled: number;

  @Column({ type: 'int', default: 0 })
  callsAnswered: number;

  @Column({ type: 'int', default: 0 })
  callsMissed: number;

  @Column({ type: 'int', default: 0 })
  totalTalkSec: number;

  @Column({ type: 'int', default: 0 })
  totalHoldSec: number;

  @Column({ type: 'int', default: 0 })
  loginSec: number;

  @Column({ type: 'int', default: 0 })
  pauseSec: number;

  @Column({ type: 'int', default: 0 })
  avgHandleSec: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

/** Nightly rollup: one row per queue per day. */
@Entity('daily_queue_stats')
@Unique(['statDate', 'queueName'])
export class DailyQueueStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'date' })
  statDate: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  @Column({ type: 'int', default: 0 })
  offered: number;

  @Column({ type: 'int', default: 0 })
  answered: number;

  @Column({ type: 'int', default: 0 })
  abandoned: number;

  @Column({ type: 'int', default: 0 })
  totalWaitSec: number;

  @Column({ type: 'int', default: 0 })
  maxWaitSec: number;

  @Column({ type: 'int', default: 0 })
  totalTalkSec: number;

  @Column({ type: 'int', default: 0 })
  avgWaitSec: number;

  @Column({ type: 'int', default: 0 })
  avgTalkSec: number;

  /** Service level: % answered within threshold (e.g. 20s). */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  serviceLevelPct: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
