import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Config-change history (Module 10). One row per mutating (POST/PATCH/PUT/
 * DELETE) request performed by an authenticated user, written best-effort by
 * AuditInterceptor. Bodies are redacted of secrets before storage.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  role: string | null;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Index()
  @Column({ type: 'varchar', length: 200 })
  path: string;

  /** create | update | delete. */
  @Column({ type: 'varchar', length: 20 })
  action: string;

  /** Top-level resource collection, e.g. "extensions", "inbound-routes". */
  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  resource: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  resourceId: string | null;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  /** Redacted request params/body for context. */
  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
