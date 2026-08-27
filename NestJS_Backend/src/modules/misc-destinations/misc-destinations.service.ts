import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { MiscDestination } from '../../database/entities';
import {
  CreateMiscDestinationDto,
  UpdateMiscDestinationDto,
} from './dto/misc-destination.dto';
import { MiscDestinationType } from '../../common/enums';
import {
  assertSafeNumber,
  sanitizeText,
} from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/** Owns misc destinations (external number / announcement / hangup) used as IVR/queue targets. */
@Injectable()
export class MiscDestinationsService {
  private readonly logger = new Logger(MiscDestinationsService.name);

  constructor(
    @InjectRepository(MiscDestination)
    private readonly repo: Repository<MiscDestination>,
  ) {}

  async create(dto: CreateMiscDestinationDto): Promise<MiscDestination> {
    const value = this.resolveValue(dto.type, dto.value);

    const entity = this.repo.create({
      name: sanitizeText(dto.name, 80),
      type: dto.type,
      value,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Misc destination ${saved.name} (${saved.type}) created`);
    return saved;
  }

  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<MiscDestination>> {
    const { page, limit, search } = query;
    const [data, total] = await this.repo.findAndCount({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<MiscDestination> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Misc destination not found');
    return entity;
  }

  async update(
    id: string,
    dto: UpdateMiscDestinationDto,
  ): Promise<MiscDestination> {
    const entity = await this.findOne(id);
    const type = dto.type ?? entity.type;
    // Revalidate the value whenever the type or the value itself changes.
    const rawValue = dto.value !== undefined ? dto.value : entity.value;
    const value = this.resolveValue(type, rawValue ?? undefined);

    await this.repo.update(id, {
      name: dto.name !== undefined ? sanitizeText(dto.name, 80) : entity.name,
      type,
      value,
    });
    this.logger.log(`Misc destination ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Misc destination not found');
    this.logger.log(`Misc destination ${id} removed`);
  }

  /** Validates/sanitizes the destination value according to its type. */
  private resolveValue(
    type: MiscDestinationType,
    value: string | undefined,
  ): string | null {
    switch (type) {
      case MiscDestinationType.EXTERNAL_NUMBER:
        if (!value) {
          throw new BadRequestException(
            'value (external number) is required for an external_number destination',
          );
        }
        return assertSafeNumber(value, 'value');
      case MiscDestinationType.ANNOUNCEMENT:
        if (!value) {
          throw new BadRequestException(
            'value (announcement sound) is required for an announcement destination',
          );
        }
        return sanitizeText(value, 200);
      case MiscDestinationType.HANGUP:
        // hangup carries no value.
        return null;
      default:
        throw new BadRequestException('Unsupported misc destination type');
    }
  }
}
