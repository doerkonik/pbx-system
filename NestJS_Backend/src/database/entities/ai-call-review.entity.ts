import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * Post-call review of one AI-handled call: the joined transcript plus an
 * auto-generated CSAT score/label and one-line summary. One row per call,
 * keyed by the Asterisk uniqueid (matches CDR + the ai-<uniqueid>.wav recording).
 * Written when the call ends (see AiAgentService.finalizeCall).
 */
@Entity('ai_call_review')
export class AiCallReview {
  @PrimaryColumn({ type: 'varchar', length: 150 })
  uniqueid: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  caller: string;

  /** Full transcript, one line per turn ("Caller: …" / "AI: …"). */
  @Column({ type: 'text', nullable: true })
  transcript: string | null;

  /** Auto CSAT 1 (poor) .. 5 (great); null if not scored. */
  @Column({ type: 'int', nullable: true })
  csatScore: number | null;

  /** satisfied | neutral | unsatisfied | unknown. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  csatLabel: string | null;

  /** One-line summary of the call. */
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
