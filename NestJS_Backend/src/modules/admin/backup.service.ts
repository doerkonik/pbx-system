import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  BackupRecord,
  BlacklistEntry,
  Campaign,
  CampaignContact,
  Conference,
  Did,
  DispositionCode,
  Holiday,
  InboundRoute,
  IvrEntry,
  IvrMenu,
  MiscDestination,
  MohClass,
  MohFile,
  OutboundRoute,
  QueueConfig,
  RingGroup,
  Skill,
  AgentSkill,
  QueueSkillRequirement,
  SlaThreshold,
  TimeCondition,
  TimeGroup,
  TimeGroupRange,
} from '../../database/entities';

interface TableSpec {
  key: string;
  entity: EntityTarget<ObjectLiteral>;
  /** Safe to re-insert on restore (no required secret cols / realtime deps). */
  restorable: boolean;
}

/**
 * Config table registry for backup/restore. Ordered so parents precede children
 * (FK-safe restore). `find()` excludes select:false secret columns, so exported
 * snapshots never contain passwords/PINs.
 */
const TABLES: TableSpec[] = [
  { key: 'skills', entity: Skill, restorable: true },
  { key: 'agent_skills', entity: AgentSkill, restorable: true },
  { key: 'queue_skill_requirements', entity: QueueSkillRequirement, restorable: true },
  { key: 'time_groups', entity: TimeGroup, restorable: true },
  { key: 'time_group_ranges', entity: TimeGroupRange, restorable: true },
  { key: 'time_conditions', entity: TimeCondition, restorable: true },
  { key: 'holidays', entity: Holiday, restorable: true },
  { key: 'dids', entity: Did, restorable: true },
  { key: 'inbound_routes', entity: InboundRoute, restorable: true },
  { key: 'outbound_routes', entity: OutboundRoute, restorable: true },
  { key: 'blacklist', entity: BlacklistEntry, restorable: true },
  { key: 'misc_destinations', entity: MiscDestination, restorable: true },
  { key: 'queue_config', entity: QueueConfig, restorable: true },
  { key: 'moh_classes', entity: MohClass, restorable: true },
  { key: 'moh_files', entity: MohFile, restorable: true },
  { key: 'ivr_menus', entity: IvrMenu, restorable: true },
  { key: 'ivr_entries', entity: IvrEntry, restorable: true },
  { key: 'conferences', entity: Conference, restorable: true },
  { key: 'ring_groups', entity: RingGroup, restorable: true },
  { key: 'disposition_codes', entity: DispositionCode, restorable: true },
  { key: 'sla_thresholds', entity: SlaThreshold, restorable: true },
  { key: 'campaigns', entity: Campaign, restorable: true },
  { key: 'campaign_contacts', entity: CampaignContact, restorable: true },
];

@Injectable()
export class BackupService implements OnModuleInit {
  private readonly logger = new Logger(BackupService.name);
  private readonly dir = process.env.BACKUP_DIR ?? path.join(process.cwd(), 'backups');

  constructor(
    @InjectRepository(BackupRecord)
    private readonly records: Repository<BackupRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true }).catch((err) =>
      this.logger.error(`Cannot create backup dir ${this.dir}: ${err.message}`),
    );
  }

  /** Build a config snapshot, write it to disk, and catalogue it. */
  async create(
    trigger: 'manual' | 'schedule' = 'manual',
    isoStamp: string,
  ): Promise<BackupRecord> {
    const tables: Record<string, ObjectLiteral[]> = {};
    let rowCount = 0;
    for (const spec of TABLES) {
      const rows = await this.dataSource.getRepository(spec.entity).find();
      tables[spec.key] = rows;
      rowCount += rows.length;
    }

    const snapshot = { version: 1, createdAt: isoStamp, tables };
    const json = JSON.stringify(snapshot, null, 2);
    const fileName = `backup-${isoStamp.replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(path.join(this.dir, fileName), json, 'utf8');

    const record = await this.records.save(
      this.records.create({
        fileName,
        type: trigger === 'schedule' ? 'scheduled' : 'full',
        sizeBytes: String(Buffer.byteLength(json)),
        tableCount: TABLES.length,
        rowCount,
        trigger,
      }),
    );
    this.logger.log(`Backup ${fileName} written (${rowCount} rows)`);
    return record;
  }

  list(): Promise<BackupRecord[]> {
    return this.records.find({ order: { createdAt: 'DESC' } });
  }

  async read(id: string): Promise<{ fileName: string; content: string }> {
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Backup not found');
    const content = await fs
      .readFile(path.join(this.dir, record.fileName), 'utf8')
      .catch(() => {
        throw new NotFoundException('Backup file missing on disk');
      });
    return { fileName: record.fileName, content };
  }

  /**
   * Additive restore: insert rows whose primary key is absent (never deletes or
   * overwrites). Only `restorable` tables are applied. Returns a per-table
   * summary.
   */
  async restore(
    snapshot: { tables?: Record<string, ObjectLiteral[]> },
  ): Promise<Record<string, { inserted: number; skipped: number; errors: number }>> {
    const summary: Record<string, { inserted: number; skipped: number; errors: number }> = {};
    const tables = snapshot?.tables ?? {};

    for (const spec of TABLES) {
      if (!spec.restorable) continue;
      const rows = tables[spec.key];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const repo = this.dataSource.getRepository(spec.entity);
      const pkCols = repo.metadata.primaryColumns.map((c) => c.propertyName);
      const stat = { inserted: 0, skipped: 0, errors: 0 };

      for (const row of rows) {
        try {
          const where: Record<string, unknown> = {};
          for (const p of pkCols) where[p] = (row as Record<string, unknown>)[p];
          const exists = await repo.findOne({ where: where as any });
          if (exists) {
            stat.skipped += 1;
            continue;
          }
          await repo.insert(row as any);
          stat.inserted += 1;
        } catch {
          stat.errors += 1;
        }
      }
      summary[spec.key] = stat;
    }
    this.logger.log('Config restore complete');
    return summary;
  }

  /** Nightly scheduled backup at 02:30. */
  @Cron('30 2 * * *')
  async scheduledBackup(): Promise<void> {
    try {
      await this.create('schedule', new Date().toISOString());
    } catch (err) {
      this.logger.error(`Scheduled backup failed: ${(err as Error).message}`);
    }
  }
}
