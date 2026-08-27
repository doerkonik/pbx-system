import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLog } from '../../database/entities';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination.dto';
import { AuditQueryDto } from './dto/audit.dto';

/** Writes + queries the config-change audit trail. Writes are best-effort. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Fire-and-forget insert — never blocks or fails the originating request. */
  async record(entry: Partial<AuditLog>): Promise<void> {
    try {
      await this.repo.save(this.repo.create(entry));
    } catch (err) {
      this.logger.error(`Audit write failed: ${(err as Error).message}`);
    }
  }

  async query(q: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
    const { page, limit, userId, resource, method, from, to } = q;
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (method) where.method = method.toUpperCase();
    if (from && to) where.createdAt = Between(new Date(from), new Date(to));
    else if (from) where.createdAt = MoreThanOrEqual(new Date(from));
    else if (to) where.createdAt = LessThanOrEqual(new Date(to));

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }
}
