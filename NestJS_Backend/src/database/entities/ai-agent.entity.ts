import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * AI voice-agent studio configuration (single row).
 *
 * Holds the business-authored identity + behaviour of the AVR/Gemini phone
 * agent. The structured fields are compiled into a single-line instruction
 * (`compiledInstructions`) which is what actually gets written to the AVR
 * `.env` (GEMINI_INSTRUCTIONS) on publish. Nothing secret is stored here — the
 * Gemini API key lives only in the AVR `.env`, never in the database.
 */
@Entity('ai_agent_config')
export class AiAgentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The agent's spoken name, e.g. "Konik". */
  @Column({ type: 'varchar', length: 120, default: 'Assistant' })
  agentName: string;

  /** Organization the agent represents. */
  @Column({ type: 'varchar', length: 160, default: '' })
  organizationName: string;

  /** One or two lines describing what the organization does. */
  @Column({ type: 'text', nullable: true })
  businessDescription: string | null;

  /** Primary spoken language: 'bn' (Bangla) or 'en' (English). */
  @Column({ type: 'varchar', length: 20, default: 'bn' })
  language: string;

  /** When Bangla-first, may switch to English if the caller does. */
  @Column({ type: 'boolean', default: true })
  allowEnglish: boolean;

  /** Tone / personality guidance. */
  @Column({ type: 'text', nullable: true })
  personality: string | null;

  /** Static business facts the agent may state (hours, policies, prices). */
  @Column({ type: 'text', nullable: true })
  businessFacts: string | null;

  /** What to do when the agent cannot help (e.g. offer a human transfer). */
  @Column({ type: 'text', nullable: true })
  fallbackBehavior: string | null;

  /** Optional opening line spoken at the start of the call. */
  @Column({ type: 'text', nullable: true })
  greeting: string | null;

  /** Gemini model id used by the speech-to-speech service. */
  @Column({
    type: 'varchar',
    length: 120,
    default: 'gemini-2.5-flash-native-audio-preview-12-2025',
  })
  model: string;

  /** Gemini prebuilt voice name ('' = model default). Set via container patch. */
  @Column({ type: 'varchar', length: 60, default: '' })
  voice: string;

  /* ----- Telephony (applied to the dialplan, not the persona .env) ----- */

  /** Internal extension that dials straight to the AI agent (test line). */
  @Column({ type: 'varchar', length: 20, default: '8888' })
  aiExten: string;

  /** Agents rung when the caller presses 3, '&'-joined (e.g. "102&103"). */
  @Column({ type: 'varchar', length: 200, default: '102&103' })
  press3Agents: string;

  /** Seconds to ring the agents before the AI takes over. */
  @Column({ type: 'int', default: 5 })
  ringSeconds: number;

  /** Whether AI calls are recorded (MixMonitor) for later review. */
  @Column({ type: 'boolean', default: true })
  recordCalls: boolean;

  /** The single-line instruction compiled from the fields above. */
  @Column({ type: 'text', nullable: true })
  compiledInstructions: string | null;

  /** True once the current draft has been pushed live to the AI. */
  @Column({ type: 'boolean', default: false })
  published: boolean;

  /** When the draft was last published to the AVR container. */
  @Column({ type: 'timestamptz', nullable: true })
  lastPublishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
