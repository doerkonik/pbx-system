import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Did } from '../../database/entities';
import { CreateDidDto, UpdateDidDto } from './dto/did.dto';
import {
  assertSafeNumber,
  sanitizeText,
} from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/** DID (phone-number) inventory. Routing lives in InboundRoutesService. */
@Injectable()
export class DidsService {
  private readonly logger = new Logger(DidsService.name);

  constructor(
    @InjectRepository(Did)
    private readonly repo: Repository<Did>,
  ) {}

  async create(dto: CreateDidDto): Promise<Did> {
    const number = assertSafeNumber(dto.number, 'number');
    const existing = await this.repo.findOne({ where: { number } });
    if (existing) throw new ConflictException(`DID ${number} already exists`);

    const entity = this.repo.create({
      number,
      description: dto.description ? sanitizeText(dto.description, 200) : null,
      trunkId: dto.trunkId ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`DID ${saved.number} created`);
    return saved;
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<Did>> {
    const { page, limit, search } = query;
    const [data, total] = await this.repo.findAndCount({
      where: search ? { number: ILike(`%${search}%`) } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<Did> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('DID not found');
    return entity;
  }

  async update(id: string, dto: UpdateDidDto): Promise<Did> {
    const entity = await this.findOne(id);
    const number =
      dto.number !== undefined
        ? assertSafeNumber(dto.number, 'number')
        : entity.number;
    if (number !== entity.number) {
      const clash = await this.repo.findOne({ where: { number } });
      if (clash) throw new ConflictException(`DID ${number} already exists`);
    }

    await this.repo.update(id, {
      number,
      description:
        dto.description !== undefined
          ? dto.description
            ? sanitizeText(dto.description, 200)
            : null
          : entity.description,
      trunkId: dto.trunkId !== undefined ? dto.trunkId ?? null : entity.trunkId,
      isActive: dto.isActive ?? entity.isActive,
    });
    this.logger.log(`DID ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('DID not found');
    this.logger.log(`DID ${id} removed`);
  }
}
