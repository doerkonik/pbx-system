import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallDisposition, DispositionCode } from '../../database/entities';
import {
  CreateDispositionCodeDto,
  SubmitDispositionDto,
  UpdateDispositionCodeDto,
} from './dto/disposition.dto';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/** Owns wrap-up code taxonomy + per-call disposition submissions. */
@Injectable()
export class DispositionsService {
  private readonly logger = new Logger(DispositionsService.name);

  constructor(
    @InjectRepository(DispositionCode)
    private readonly codes: Repository<DispositionCode>,
    @InjectRepository(CallDisposition)
    private readonly dispositions: Repository<CallDisposition>,
  ) {}

  /* ---------------------------- Codes (admin) -------------------------- */

  async createCode(dto: CreateDispositionCodeDto): Promise<DispositionCode> {
    const code = sanitizeText(dto.code, 40);
    if (await this.codes.findOne({ where: { code } })) {
      throw new ConflictException(`Disposition code ${code} already exists`);
    }
    const entity = this.codes.create({
      code,
      label: sanitizeText(dto.label, 120),
      category: dto.category,
      requiresNote: dto.requiresNote ?? false,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.codes.save(entity);
    this.logger.log(`Disposition code ${saved.code} created`);
    return saved;
  }

  /** List codes; `activeOnly` is what agents use when picking an outcome. */
  findCodes(activeOnly = false): Promise<DispositionCode[]> {
    return this.codes.find({
      where: activeOnly ? { isActive: true } : {},
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  async findCode(id: string): Promise<DispositionCode> {
    const entity = await this.codes.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Disposition code not found');
    return entity;
  }

  async updateCode(
    id: string,
    dto: UpdateDispositionCodeDto,
  ): Promise<DispositionCode> {
    const entity = await this.findCode(id);
    if (dto.code && dto.code !== entity.code) {
      const code = sanitizeText(dto.code, 40);
      if (await this.codes.findOne({ where: { code } })) {
        throw new ConflictException(`Disposition code ${code} already exists`);
      }
      entity.code = code;
    }
    if (dto.label !== undefined) entity.label = sanitizeText(dto.label, 120);
    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.requiresNote !== undefined) entity.requiresNote = dto.requiresNote;
    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) entity.isActive = dto.isActive;
    const saved = await this.codes.save(entity);
    this.logger.log(`Disposition code ${id} updated`);
    return saved;
  }

  async removeCode(id: string): Promise<void> {
    const res = await this.codes.delete(id);
    if (!res.affected) throw new NotFoundException('Disposition code not found');
  }

  /* ---------------------- Submissions (agent) -------------------------- */

  /**
   * Record (or overwrite) an agent's disposition for a call. Idempotent per
   * (uniqueid, agentId): a re-submit updates the existing row.
   */
  async submit(
    uniqueid: string,
    agentId: string,
    extension: string | null,
    dto: SubmitDispositionDto,
  ): Promise<CallDisposition> {
    const code = await this.findCode(dto.dispositionCodeId);
    if (!code.isActive) {
      throw new BadRequestException('Disposition code is inactive');
    }
    if (code.requiresNote && !dto.note?.trim()) {
      throw new BadRequestException(
        `Disposition "${code.label}" requires a note`,
      );
    }

    const existing = await this.dispositions.findOne({
      where: { uniqueid, agentId },
    });
    const entity =
      existing ??
      this.dispositions.create({ uniqueid, agentId, extension });
    entity.dispositionCodeId = code.id;
    entity.note = dto.note?.trim() || null;
    entity.acwSec = dto.acwSec ?? entity.acwSec ?? null;
    entity.extension = extension ?? entity.extension ?? null;

    const saved = await this.dispositions.save(entity);
    this.logger.log(
      `Disposition ${code.code} recorded for call ${uniqueid} by ${agentId}`,
    );
    return saved;
  }

  /** Paginated disposition log for supervisor/admin reporting. */
  async findSubmitted(
    query: PaginationDto & { agentId?: string; uniqueid?: string },
  ): Promise<PaginatedResult<CallDisposition>> {
    const { page, limit, agentId, uniqueid } = query;
    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (uniqueid) where.uniqueid = uniqueid;
    const [data, total] = await this.dispositions.findAndCount({
      where,
      relations: { dispositionCode: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }
}
