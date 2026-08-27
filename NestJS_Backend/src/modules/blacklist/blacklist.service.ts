import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { BlacklistEntry } from '../../database/entities';
import {
  CreateBlacklistDto,
  UpdateBlacklistDto,
} from './dto/blacklist.dto';
import { BlacklistDirection } from '../../common/enums';
import { assertSafeNumber } from '../../common/utils/asterisk-sanitize';
import { TelephonyService } from '../../telephony/telephony.service';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/** Owns the blacklist config. Enforcement at call-start lives in TelephonyService. */
@Injectable()
export class BlacklistService {
  private readonly logger = new Logger(BlacklistService.name);

  constructor(
    @InjectRepository(BlacklistEntry)
    private readonly repo: Repository<BlacklistEntry>,
    private readonly telephony: TelephonyService,
  ) {}

  async create(dto: CreateBlacklistDto): Promise<BlacklistEntry> {
    const number = assertSafeNumber(dto.number, 'number');
    const direction = dto.direction ?? BlacklistDirection.BOTH;

    const existing = await this.repo.findOne({ where: { number, direction } });
    if (existing) {
      throw new ConflictException(
        `${number} is already blacklisted for ${direction}`,
      );
    }

    const entry = this.repo.create({
      number,
      direction,
      reason: dto.reason ?? null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(entry);
    this.logger.log(`Blacklisted ${number} (${direction})`);
    return saved;
  }

  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<BlacklistEntry>> {
    const { page, limit, search } = query;
    const [data, total] = await this.repo.findAndCount({
      where: search ? { number: ILike(`%${search}%`) } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<BlacklistEntry> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Blacklist entry not found');
    return entry;
  }

  async update(id: string, dto: UpdateBlacklistDto): Promise<BlacklistEntry> {
    const entry = await this.findOne(id);
    const number = dto.number
      ? assertSafeNumber(dto.number, 'number')
      : entry.number;

    await this.repo.update(id, {
      number,
      direction: dto.direction ?? entry.direction,
      reason: dto.reason !== undefined ? dto.reason : entry.reason,
      isActive: dto.isActive ?? entry.isActive,
    });
    this.logger.log(`Blacklist entry ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Blacklist entry not found');
    this.logger.log(`Blacklist entry ${id} removed`);
  }

  /** Delegates the live blocked-check to the telephony module. */
  async check(
    number: string,
    direction: BlacklistDirection,
  ): Promise<{ blocked: boolean }> {
    const num = assertSafeNumber(number, 'number');
    const blocked = await this.telephony.isBlacklisted(num, direction);
    return { blocked };
  }
}
