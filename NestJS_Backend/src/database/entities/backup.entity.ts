import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Backup & system admin (Module 13). One row per config snapshot written to
 * disk (BACKUP_DIR). The JSON file holds config tables (secrets excluded); this
 * row is the catalogue entry used to list/download/restore.
 */
@Entity('backup_records')
export class BackupRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  fileName: string;

  /** full | partial | scheduled */
  @Column({ type: 'varchar', length: 20, default: 'full' })
  type: string;

  @Column({ type: 'bigint', default: 0 })
  sizeBytes: string;

  @Column({ type: 'int', default: 0 })
  tableCount: number;

  @Column({ type: 'int', default: 0 })
  rowCount: number;

  /** How it was triggered — manual | schedule. */
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  trigger: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
