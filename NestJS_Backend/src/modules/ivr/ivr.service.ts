import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Repository } from 'typeorm';
import { IvrEntry, IvrMenu } from '../../database/entities';
import {
  CreateIvrMenuDto,
  IvrEntryDto,
  UpdateIvrMenuDto,
} from './dto/ivr.dto';
import { IvrDestinationType } from '../../common/enums';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/**
 * CRUD/config for IVR menus and their DTMF entries. The LIVE execution of a menu
 * (playing greetings, collecting DTMF, routing) is owned by
 * telephony/ivr-runner.service.ts — this module never executes calls, it only
 * manages the `ivr_menus` / `ivr_entries` rows the runner reads.
 */
@Injectable()
export class IvrService {
  private readonly logger = new Logger(IvrService.name);

  constructor(
    @InjectRepository(IvrMenu)
    private readonly menuRepo: Repository<IvrMenu>,
    private readonly dataSource: DataSource,
  ) {}

  /** A destination is only allowed to omit destValue when it is a hangup. */
  private assertDestValue(
    destType: IvrDestinationType,
    destValue: string | undefined | null,
    context: string,
  ): void {
    if (destType === IvrDestinationType.HANGUP) return;
    if (!destValue || destValue.trim().length === 0) {
      throw new BadRequestException(
        `${context}: destValue is required when destType is "${destType}"`,
      );
    }
  }

  /** Rejects duplicate DTMF digits within a single menu. */
  private assertUniqueDigits(entries: IvrEntryDto[]): void {
    const seen = new Set<string>();
    for (const entry of entries) {
      if (seen.has(entry.digit)) {
        throw new BadRequestException(
          `Duplicate digit "${entry.digit}" within the menu`,
        );
      }
      seen.add(entry.digit);
    }
  }

  private validate(dto: CreateIvrMenuDto): void {
    this.assertUniqueDigits(dto.entries);
    dto.entries.forEach((e, i) =>
      this.assertDestValue(e.destType, e.destValue, `entries[${i}] (digit ${e.digit})`),
    );
    if (dto.invalidDestType !== undefined) {
      this.assertDestValue(
        dto.invalidDestType,
        dto.invalidDestValue,
        'invalidDest',
      );
    }
  }

  async create(dto: CreateIvrMenuDto): Promise<IvrMenu> {
    this.validate(dto);

    const existing = await this.menuRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`IVR menu ${dto.name} already exists`);
    }

    const menu = this.menuRepo.create({
      name: dto.name,
      greetingSound: dto.greetingSound,
      digitTimeoutSec: dto.digitTimeoutSec ?? 5,
      maxRetries: dto.maxRetries ?? 3,
      invalidDestType: dto.invalidDestType ?? IvrDestinationType.HANGUP,
      invalidDestValue: dto.invalidDestValue ?? null,
      isActive: dto.isActive ?? true,
      entries: dto.entries.map((e) =>
        Object.assign(new IvrEntry(), {
          digit: e.digit,
          destType: e.destType,
          destValue: e.destValue ?? null,
          label: e.label ?? null,
        }),
      ),
    });

    // cascade: true on IvrMenu.entries persists the entries in the same save.
    const saved = await this.menuRepo.save(menu);
    this.logger.log(`IVR menu ${saved.name} created with ${saved.entries.length} entries`);
    return this.findOne(saved.id);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<IvrMenu>> {
    const { page, limit, search } = query;
    const [data, total] = await this.menuRepo.findAndCount({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<IvrMenu> {
    const menu = await this.menuRepo.findOne({
      where: { id },
      relations: { entries: true },
      order: { entries: { digit: 'ASC' } },
    });
    if (!menu) throw new NotFoundException('IVR menu not found');
    return menu;
  }

  /**
   * Updates menu fields and, when `entries` is supplied, replaces ALL entries
   * atomically (delete-then-insert inside one transaction).
   */
  async update(id: string, dto: UpdateIvrMenuDto): Promise<IvrMenu> {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('IVR menu not found');

    if (dto.name !== undefined && dto.name !== menu.name) {
      const clash = await this.menuRepo.findOne({ where: { name: dto.name } });
      if (clash) {
        throw new ConflictException(`IVR menu ${dto.name} already exists`);
      }
    }

    if (dto.entries !== undefined) {
      this.assertUniqueDigits(dto.entries);
      dto.entries.forEach((e, i) =>
        this.assertDestValue(
          e.destType,
          e.destValue,
          `entries[${i}] (digit ${e.digit})`,
        ),
      );
    }

    const nextInvalidType = dto.invalidDestType ?? menu.invalidDestType;
    const nextInvalidValue =
      dto.invalidDestValue !== undefined
        ? dto.invalidDestValue
        : menu.invalidDestValue;
    if (dto.invalidDestType !== undefined || dto.invalidDestValue !== undefined) {
      this.assertDestValue(nextInvalidType, nextInvalidValue, 'invalidDest');
    }

    await this.dataSource.transaction(async (mgr) => {
      await mgr.getRepository(IvrMenu).update(id, {
        name: dto.name ?? menu.name,
        greetingSound: dto.greetingSound ?? menu.greetingSound,
        digitTimeoutSec: dto.digitTimeoutSec ?? menu.digitTimeoutSec,
        maxRetries: dto.maxRetries ?? menu.maxRetries,
        invalidDestType: nextInvalidType,
        invalidDestValue: nextInvalidValue,
        isActive: dto.isActive ?? menu.isActive,
      });

      if (dto.entries !== undefined) {
        await mgr.getRepository(IvrEntry).delete({ menuId: id });
        if (dto.entries.length > 0) {
          const rows = dto.entries.map((e) =>
            mgr.getRepository(IvrEntry).create({
              menuId: id,
              digit: e.digit,
              destType: e.destType,
              destValue: e.destValue ?? null,
              label: e.label ?? null,
            }),
          );
          await mgr.getRepository(IvrEntry).save(rows);
        }
      }
    });

    this.logger.log(`IVR menu ${dto.name ?? menu.name} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const menu = await this.menuRepo.findOne({ where: { id } });
    if (!menu) throw new NotFoundException('IVR menu not found');
    // ivr_entries cascade-delete via the FK (onDelete: 'CASCADE').
    await this.menuRepo.delete(id);
    this.logger.log(`IVR menu ${menu.name} deleted`);
  }
}
