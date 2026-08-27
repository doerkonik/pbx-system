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
 * Outbound dialer campaigns (Module 5). Preview mode only for now: an agent
 * pulls the next contact and click-to-dials via TelephonyService.originateCall.
 * `mode`/`status`/contact `status` are plain varchar validated at the DTO layer
 * (see RouteDestinationType precedent) so pacing modes can grow without ALTERs.
 */
@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** CampaignMode — 'preview' | 'progressive' | 'predictive'. */
  @Column({ type: 'varchar', length: 20, default: 'preview' })
  mode: string;

  /** Outbound caller id presented on campaign calls. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  callerId: string | null;

  /** CampaignStatus — 'draft' | 'active' | 'paused' | 'done'. */
  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  @OneToMany(() => CampaignContact, (c) => c.campaign)
  contacts: CampaignContact[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('campaign_contacts')
@Index(['campaignId', 'status'])
export class CampaignContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Campaign, (c) => c.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Index()
  @Column({ type: 'uuid' })
  campaignId: string;

  @Column({ type: 'varchar', length: 40 })
  phone: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  /** Arbitrary CRM fields shown to the agent on the preview screen. */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, unknown>;

  /** CampaignContactStatus — 'pending' | 'assigned' | 'done' | 'dnc'. */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  /** Agent (users.id) currently holding this contact in preview. */
  @Column({ type: 'uuid', nullable: true })
  assignedAgentId: string | null;

  /** AMI actionId / uniqueid of the most recent dial attempt. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  lastUniqueid: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
