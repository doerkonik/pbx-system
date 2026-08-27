import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RingGroup } from '../../database/entities';
import { CreateRingGroupDto, UpdateRingGroupDto } from './dto/ring-group.dto';
import { RingGroupStrategy } from '../../common/enums';
import { assertSafeNumber, sanitizeText } from '../../common/utils/asterisk-sanitize';
import { assertRouteDest } from '../../common/utils/route-destination';

/**
 * Ring-group config (Module 2). CRUD only; the ARI Stasis handler reads these
 * (via findByNumber) to actually ring members — that execution wiring is a
 * telephony follow-up, mirroring how inbound-route resolution is consumed.
 */
@Injectable()
export class RingGroupsService {
  private readonly logger = new Logger(RingGroupsService.name);

  constructor(
    @InjectRepository(RingGroup)
    private readonly repo: Repository<RingGroup>,
  ) {}

  async create(dto: CreateRingGroupDto): Promise<RingGroup> {
    const number = assertSafeNumber(dto.number, 'number');
    if (await this.repo.findOne({ where: { number } })) {
      throw new ConflictException(`Ring group ${number} already exists`);
    }
    const entity = this.repo.create({
      number,
      name: sanitizeText(dto.name, 80),
      strategy: dto.strategy ?? RingGroupStrategy.RINGALL,
      memberExtensions: dto.memberExtensions.map((m) => assertSafeNumber(m, 'member')),
      ringTimeSec: dto.ringTimeSec ?? 20,
      noAnswerDestType: dto.noAnswerDestType ?? 'hangup',
      noAnswerDestValue: assertRouteDest(
        dto.noAnswerDestType ?? 'hangup',
        dto.noAnswerDestValue,
        'noAnswerDest',
      ),
      callerIdPrefix: dto.callerIdPrefix
        ? sanitizeText(dto.callerIdPrefix, 40)
        : null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Ring group ${number} created`);
    return saved;
  }

  findAll(): Promise<RingGroup[]> {
    return this.repo.find({ order: { number: 'ASC' } });
  }

  async findOne(id: string): Promise<RingGroup> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Ring group not found');
    return entity;
  }

  /** Used by the Stasis handler to route a call to a ring group by number. */
  findByNumber(number: string): Promise<RingGroup | null> {
    return this.repo.findOne({ where: { number, isActive: true } });
  }

  async update(id: string, dto: UpdateRingGroupDto): Promise<RingGroup> {
    const entity = await this.findOne(id);
    const noAnswerDestType = dto.noAnswerDestType ?? entity.noAnswerDestType;

    await this.repo.update(id, {
      name: dto.name !== undefined ? sanitizeText(dto.name, 80) : entity.name,
      strategy: dto.strategy ?? entity.strategy,
      memberExtensions: dto.memberExtensions
        ? dto.memberExtensions.map((m) => assertSafeNumber(m, 'member'))
        : entity.memberExtensions,
      ringTimeSec: dto.ringTimeSec ?? entity.ringTimeSec,
      noAnswerDestType,
      noAnswerDestValue: assertRouteDest(
        noAnswerDestType,
        dto.noAnswerDestValue !== undefined
          ? dto.noAnswerDestValue
          : entity.noAnswerDestValue,
        'noAnswerDest',
      ),
      callerIdPrefix:
        dto.callerIdPrefix !== undefined
          ? dto.callerIdPrefix
            ? sanitizeText(dto.callerIdPrefix, 40)
            : null
          : entity.callerIdPrefix,
      isActive: dto.isActive ?? entity.isActive,
    });
    this.logger.log(`Ring group ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Ring group not found');
  }
}
