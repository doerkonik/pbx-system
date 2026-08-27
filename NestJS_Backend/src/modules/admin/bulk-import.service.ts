import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExtensionsService } from '../extensions/extensions.service';
import { UsersService } from '../users/users.service';
import { CreateExtensionDto } from '../extensions/dto/extension.dto';
import { CreateUserDto } from '../users/dto/user.dto';
import { UserRole } from '../../common/enums';
import { parseCsv } from '../../common/utils/csv';

export interface RowResult {
  row: number;
  ref: string;
  status: 'ok' | 'error';
  error?: string;
}
export interface ImportSummary {
  total: number;
  imported: number;
  failed: number;
  results: RowResult[];
}

const truthy = (v: unknown): boolean =>
  ['1', 'true', 'yes', 'y'].includes(String(v ?? '').trim().toLowerCase());

/** CSV/JSON bulk import for extensions and users (Module 13). */
@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);

  constructor(
    private readonly extensions: ExtensionsService,
    private readonly users: UsersService,
  ) {}

  /** Accept either parsed `rows` or raw `csv`; returns row objects. */
  private rows(input: { csv?: string; rows?: Record<string, any>[] }): Record<string, any>[] {
    if (Array.isArray(input.rows) && input.rows.length) return input.rows;
    if (typeof input.csv === 'string' && input.csv.trim()) return parseCsv(input.csv);
    throw new BadRequestException('Provide either `rows` (array) or `csv` (string)');
  }

  private async validateDto<T extends object>(cls: new () => T, plain: object): Promise<T> {
    const dto = plainToInstance(cls, plain, { enableImplicitConversion: true });
    const errors = await validate(dto as object, {
      whitelist: true,
      forbidUnknownValues: false,
    });
    if (errors.length) {
      const msg = errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .filter(Boolean)
        .join('; ');
      throw new BadRequestException(msg || 'Validation failed');
    }
    return dto;
  }

  async importExtensions(input: { csv?: string; rows?: Record<string, any>[] }): Promise<ImportSummary> {
    const rows = this.rows(input);
    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ref = String(r.extensionNumber ?? r.extension ?? '');
      try {
        const dto = await this.validateDto(CreateExtensionDto, {
          extensionNumber: String(r.extensionNumber ?? r.extension ?? '').trim(),
          secret: String(r.secret ?? r.password ?? '').trim(),
          displayName: r.displayName || undefined,
          department: r.department || undefined,
          webrtc: r.webrtc !== undefined ? truthy(r.webrtc) : undefined,
          recordingEnabled:
            r.recordingEnabled !== undefined ? truthy(r.recordingEnabled) : undefined,
        });
        await this.extensions.create(dto);
        results.push({ row: i + 1, ref, status: 'ok' });
      } catch (err) {
        results.push({ row: i + 1, ref, status: 'error', error: (err as Error).message });
      }
    }
    return this.summarize(results);
  }

  async importUsers(input: { csv?: string; rows?: Record<string, any>[] }): Promise<ImportSummary> {
    const rows = this.rows(input);
    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ref = String(r.username ?? '');
      try {
        const roleRaw = String(r.role ?? UserRole.AGENT).trim().toLowerCase();
        const dto = await this.validateDto(CreateUserDto, {
          username: String(r.username ?? '').trim(),
          password: String(r.password ?? '').trim(),
          role: roleRaw,
          email: r.email || undefined,
          fullName: r.fullName || undefined,
          extension: r.extension ? String(r.extension).trim() : undefined,
        });
        await this.users.create(dto);
        results.push({ row: i + 1, ref, status: 'ok' });
      } catch (err) {
        results.push({ row: i + 1, ref, status: 'error', error: (err as Error).message });
      }
    }
    return this.summarize(results);
  }

  private summarize(results: RowResult[]): ImportSummary {
    const imported = results.filter((r) => r.status === 'ok').length;
    return {
      total: results.length,
      imported,
      failed: results.length - imported,
      results,
    };
  }
}
