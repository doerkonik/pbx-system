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
 * Quality Assurance (Module 9). `QaForm`/`QaQuestion` are the scorecard
 * template; `QaEvaluation`/`QaScore` are a supervisor's scoring of a specific
 * call (linked to cdr by uniqueid); `CallNote` is lightweight coaching notes +
 * tags attached to a call.
 */
@Entity('qa_forms')
export class QaForm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 300, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => QaQuestion, (q) => q.form, { cascade: true })
  questions: QaQuestion[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('qa_questions')
export class QaQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QaForm, (f) => f.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: QaForm;

  @Index()
  @Column({ type: 'uuid' })
  formId: string;

  /** Optional grouping heading (e.g. "Greeting", "Compliance"). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  section: string | null;

  @Column({ type: 'varchar', length: 400 })
  text: string;

  @Column({ type: 'int', default: 5 })
  maxScore: number;

  /** Relative weight when aggregating the final percentage. */
  @Column({ type: 'int', default: 1 })
  weight: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}

@Entity('qa_evaluations')
@Index(['evaluatorId', 'status'])
export class QaEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  formId: string;

  /** CDR uniqueid of the evaluated call (soft FK → cdr.uniqueid). */
  @Index()
  @Column({ type: 'varchar', length: 150 })
  uniqueid: string;

  /** The evaluated agent. */
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  agentExtension: string | null;

  @Column({ type: 'uuid', nullable: true })
  agentId: string | null;

  /** The user assigned to perform the evaluation. */
  @Index()
  @Column({ type: 'uuid' })
  evaluatorId: string;

  @Column({ type: 'uuid', nullable: true })
  assignedById: string | null;

  /** QaEvaluationStatus. */
  @Column({ type: 'varchar', length: 20, default: 'assigned' })
  status: string;

  @Column({ type: 'int', default: 0 })
  totalScore: number;

  @Column({ type: 'int', default: 0 })
  maxScore: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  scorePct: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => QaScore, (s) => s.evaluation, { cascade: true })
  scores: QaScore[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('qa_scores')
@Index(['evaluationId', 'questionId'], { unique: true })
export class QaScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => QaEvaluation, (e) => e.scores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evaluationId' })
  evaluation: QaEvaluation;

  @Column({ type: 'uuid' })
  evaluationId: string;

  @Column({ type: 'uuid' })
  questionId: string;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;
}

@Entity('call_notes')
export class CallNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  uniqueid: string;

  @Column({ type: 'uuid' })
  authorId: string;

  @Column({ type: 'text' })
  note: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
