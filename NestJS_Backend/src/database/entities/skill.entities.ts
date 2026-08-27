import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Skill-based routing (Module 2). A `Skill` is a competency; `AgentSkill` grants
 * an extension a proficiency level (1-5); `QueueSkillRequirement` says which
 * skills a queue needs and the minimum level. SkillsService turns these into
 * per-agent queue penalties (higher skill → lower penalty → served first).
 */
@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('agent_skills')
@Index(['extension', 'skillId'], { unique: true })
export class AgentSkill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 40 })
  extension: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @Column({ type: 'uuid' })
  skillId: string;

  /** Proficiency 1 (basic) .. 5 (expert). */
  @Column({ type: 'int', default: 3 })
  level: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('queue_skill_requirements')
@Index(['queueName', 'skillId'], { unique: true })
export class QueueSkillRequirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  queueName: string;

  @ManyToOne(() => Skill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill: Skill;

  @Column({ type: 'uuid' })
  skillId: string;

  /** Minimum proficiency an agent needs to take calls from this queue. */
  @Column({ type: 'int', default: 1 })
  minLevel: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
