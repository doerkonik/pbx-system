import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Per-agent persistent preferences (Module 5). Currently just the DND flag —
 * kept separate from `agent_status_log` so it never collides with the "one open
 * break row per agent" invariant. Keyed by users.id.
 */
@Entity('agent_preferences')
export class AgentPreference {
  @PrimaryColumn({ type: 'uuid' })
  agentId: string;

  /** Do-not-disturb: agent has flagged themselves unavailable for calls. */
  @Column({ type: 'boolean', default: false })
  dnd: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
