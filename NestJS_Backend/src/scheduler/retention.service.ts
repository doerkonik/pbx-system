import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RecordingConfig } from '../config/configuration';
import { Recording } from '../database/entities';

/**
 * Archives recordings older than RECORDING_RETENTION_DAYS: their audio file is
 * moved into RECORDING_ARCHIVE_DIR and the row is flagged archived=true. It works
 * on the Recording repo + filesystem directly (rather than importing the
 * Recordings module) to keep the scheduler self-contained. Every fs op is guarded.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectRepository(Recording)
    private readonly recordingRepo: Repository<Recording>,
    private readonly config: ConfigService,
  ) {}

  private get recordingConfig(): RecordingConfig {
    return this.config.get<RecordingConfig>('recording')!;
  }

  /** Every day at 03:30. */
  @Cron('30 3 * * *')
  async runRetention(): Promise<void> {
    try {
      await this.archiveOldRecordings();
    } catch (err) {
      this.logger.error(
        `Recording retention job failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Move every un-archived recording older than the retention window into the
   * archive directory and mark it archived. Returns a summary count.
   */
  async archiveOldRecordings(): Promise<{ archived: number; failed: number }> {
    const cfg = this.recordingConfig;
    const retentionDays = cfg?.retentionDays ?? 90;
    const archiveDir = cfg?.archiveDir;

    if (!archiveDir) {
      this.logger.warn(
        'RECORDING_ARCHIVE_DIR is not configured; skipping retention run',
      );
      return { archived: 0, failed: 0 };
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const stale = await this.recordingRepo.find({
      where: { archived: false, createdAt: LessThan(cutoff) },
    });

    if (stale.length === 0) {
      this.logger.log(
        `Recording retention: nothing older than ${retentionDays} day(s) to archive`,
      );
      return { archived: 0, failed: 0 };
    }

    try {
      await fs.mkdir(archiveDir, { recursive: true });
    } catch (err) {
      this.logger.error(
        `Could not create archive dir ${archiveDir}: ${(err as Error).message}`,
      );
      return { archived: 0, failed: stale.length };
    }

    let archived = 0;
    let failed = 0;

    for (const rec of stale) {
      try {
        const dest = path.join(archiveDir, path.basename(rec.filePath));
        await this.moveFile(rec.filePath, dest);
        rec.filePath = dest;
        rec.archived = true;
        await this.recordingRepo.save(rec);
        archived += 1;
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Failed to archive recording ${rec.id} (${rec.filePath}): ${
            (err as Error).message
          }`,
        );
      }
    }

    this.logger.log(
      `Recording retention complete: archived=${archived}, failed=${failed}, cutoff=${cutoff.toISOString()}`,
    );
    return { archived, failed };
  }

  /** Move a file, falling back to copy+unlink across filesystem boundaries. */
  private async moveFile(src: string, dest: string): Promise<void> {
    try {
      await fs.rename(src, dest);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        await fs.copyFile(src, dest);
        await fs.unlink(src);
        return;
      }
      throw err;
    }
  }
}
