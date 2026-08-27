import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Agent call-disposition / wrap-up codes (Module 5 — Agent Management).
 *
 * `DispositionCode` is admin-configured taxonomy; `CallDisposition` is the
 * per-call outcome an agent submits during after-call work. It links to a CDR
 * row by `uniqueid` (soft FK — Asterisk owns the `cdr` table, same pattern as
 * Recording.uniqueid) and to the agent by `agentId` (users.id).
 */
@Entity('disposition_codes')
export class DispositionCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  /** DispositionCategory (stored as varchar, validated at the DTO layer). */
  @Column({ type: 'varchar', length: 40, default: 'other' })
  category: string;

  /** When true, the agent must supply a note to submit this disposition. */
  @Column({ type: 'boolean', default: false })
  requiresNote: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('call_dispositions')
@Index(['uniqueid', 'agentId'], { unique: true })
export class CallDisposition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** CDR uniqueid of the dispositioned call (soft FK → cdr.uniqueid). */
  @Index()
  @Column({ type: 'varchar', length: 150 })
  uniqueid: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  linkedid: string | null;

  /** users.id of the agent who submitted it. */
  @Index()
  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  extension: string | null;

  @ManyToOne(() => DispositionCode, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dispositionCodeId' })
  dispositionCode: DispositionCode;

  @Column({ type: 'uuid' })
  dispositionCodeId: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** After-call-work seconds spent on this disposition, if tracked. */
  @Column({ type: 'int', nullable: true })
  acwSec: number | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
