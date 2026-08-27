import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Holiday,
  TimeCondition,
  TimeGroup,
  TimeGroupRange,
} from '../../database/entities';
import {
  CreateHolidayDto,
  CreateTimeConditionDto,
  CreateTimeGroupDto,
  UpdateHolidayDto,
  UpdateTimeConditionDto,
  UpdateTimeGroupDto,
} from './dto/time-routing.dto';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';
import { assertRouteDest } from '../../common/utils/route-destination';

/** Resolved destination (type/value) returned by time evaluation. */
export interface RouteTarget {
  destType: string;
  destValue: string | null;
}

/**
 * Owns business-hours primitives: time groups (sets of ranges), time conditions
 * (match/no-match branch on "now"), and holidays. Also exposes evaluation
 * helpers the inbound-routing resolver calls at call time — evaluation happens
 * in Node so edits apply instantly with no Asterisk reload.
 */
@Injectable()
export class TimeRoutingService {
  private readonly logger = new Logger(TimeRoutingService.name);

  constructor(
    @InjectRepository(TimeGroup)
    private readonly groups: Repository<TimeGroup>,
    @InjectRepository(TimeGroupRange)
    private readonly ranges: Repository<TimeGroupRange>,
    @InjectRepository(TimeCondition)
    private readonly conditions: Repository<TimeCondition>,
    @InjectRepository(Holiday)
    private readonly holidays: Repository<Holiday>,
  ) {}

  /* ---------------------------- Time groups ---------------------------- */

  async createGroup(dto: CreateTimeGroupDto): Promise<TimeGroup> {
    const group = this.groups.create({
      name: sanitizeText(dto.name, 80),
      ranges: dto.ranges.map((r) => this.ranges.create({ ...r })),
    });
    const saved = await this.groups.save(group);
    this.logger.log(`Time group ${saved.name} created`);
    return this.findGroup(saved.id);
  }

  findGroups(): Promise<TimeGroup[]> {
    return this.groups.find({ relations: { ranges: true }, order: { name: 'ASC' } });
  }

  async findGroup(id: string): Promise<TimeGroup> {
    const group = await this.groups.findOne({
      where: { id },
      relations: { ranges: true },
    });
    if (!group) throw new NotFoundException('Time group not found');
    return group;
  }

  async updateGroup(id: string, dto: UpdateTimeGroupDto): Promise<TimeGroup> {
    const group = await this.findGroup(id);
    if (dto.name !== undefined) group.name = sanitizeText(dto.name, 80);
    if (dto.ranges !== undefined) {
      // Replace the range set wholesale (cascade + orphan removal via delete).
      await this.ranges.delete({ timeGroupId: id });
      group.ranges = dto.ranges.map((r) =>
        this.ranges.create({ ...r, timeGroupId: id }),
      );
    }
    await this.groups.save(group);
    this.logger.log(`Time group ${id} updated`);
    return this.findGroup(id);
  }

  async removeGroup(id: string): Promise<void> {
    const res = await this.groups.delete(id);
    if (!res.affected) throw new NotFoundException('Time group not found');
  }

  /* -------------------------- Time conditions -------------------------- */

  async createCondition(dto: CreateTimeConditionDto): Promise<TimeCondition> {
    await this.findGroup(dto.timeGroupId); // ensure referenced group exists
    const entity = this.conditions.create({
      name: sanitizeText(dto.name, 80),
      timeGroupId: dto.timeGroupId,
      matchDestType: dto.matchDestType,
      matchDestValue: assertRouteDest(dto.matchDestType, dto.matchDestValue, 'matchDest'),
      noMatchDestType: dto.noMatchDestType,
      noMatchDestValue: assertRouteDest(
        dto.noMatchDestType,
        dto.noMatchDestValue,
        'noMatchDest',
      ),
      isActive: dto.isActive ?? true,
    });
    const saved = await this.conditions.save(entity);
    this.logger.log(`Time condition ${saved.name} created`);
    return saved;
  }

  findConditions(): Promise<TimeCondition[]> {
    return this.conditions.find({ order: { createdAt: 'DESC' } });
  }

  async findCondition(id: string): Promise<TimeCondition> {
    const entity = await this.conditions.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Time condition not found');
    return entity;
  }

  async updateCondition(
    id: string,
    dto: UpdateTimeConditionDto,
  ): Promise<TimeCondition> {
    const entity = await this.findCondition(id);
    if (dto.timeGroupId) await this.findGroup(dto.timeGroupId);

    const matchDestType = dto.matchDestType ?? entity.matchDestType;
    const noMatchDestType = dto.noMatchDestType ?? entity.noMatchDestType;
    await this.conditions.update(id, {
      name: dto.name !== undefined ? sanitizeText(dto.name, 80) : entity.name,
      timeGroupId: dto.timeGroupId ?? entity.timeGroupId,
      matchDestType,
      matchDestValue: assertRouteDest(
        matchDestType,
        dto.matchDestValue !== undefined ? dto.matchDestValue : entity.matchDestValue,
        'matchDest',
      ),
      noMatchDestType,
      noMatchDestValue: assertRouteDest(
        noMatchDestType,
        dto.noMatchDestValue !== undefined
          ? dto.noMatchDestValue
          : entity.noMatchDestValue,
        'noMatchDest',
      ),
      isActive: dto.isActive ?? entity.isActive,
    });
    return this.findCondition(id);
  }

  async removeCondition(id: string): Promise<void> {
    const res = await this.conditions.delete(id);
    if (!res.affected) throw new NotFoundException('Time condition not found');
  }

  /* ------------------------------ Holidays ----------------------------- */

  async createHoliday(dto: CreateHolidayDto): Promise<Holiday> {
    const entity = this.holidays.create({
      name: sanitizeText(dto.name, 80),
      date: dto.date,
      recurring: dto.recurring ?? false,
      destType: dto.destType,
      destValue: assertRouteDest(dto.destType, dto.destValue),
      isActive: dto.isActive ?? true,
    });
    const saved = await this.holidays.save(entity);
    this.logger.log(`Holiday ${saved.name} (${saved.date}) created`);
    return saved;
  }

  findHolidays(): Promise<Holiday[]> {
    return this.holidays.find({ order: { date: 'ASC' } });
  }

  async findHoliday(id: string): Promise<Holiday> {
    const entity = await this.holidays.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Holiday not found');
    return entity;
  }

  async updateHoliday(id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    const entity = await this.findHoliday(id);
    const destType = dto.destType ?? entity.destType;
    await this.holidays.update(id, {
      name: dto.name !== undefined ? sanitizeText(dto.name, 80) : entity.name,
      date: dto.date ?? entity.date,
      recurring: dto.recurring ?? entity.recurring,
      destType,
      destValue: assertRouteDest(
        destType,
        dto.destValue !== undefined ? dto.destValue : entity.destValue,
      ),
      isActive: dto.isActive ?? entity.isActive,
    });
    return this.findHoliday(id);
  }

  async removeHoliday(id: string): Promise<void> {
    const res = await this.holidays.delete(id);
    if (!res.affected) throw new NotFoundException('Holiday not found');
  }

  /* ----------------------------- Evaluation ---------------------------- */

  /**
   * Returns the active holiday target for `now`, or null if today is not a
   * holiday. Recurring holidays ignore the year.
   */
  async holidayTarget(now: Date): Promise<RouteTarget | null> {
    const rows = await this.holidays.find({ where: { isActive: true } });
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    const yyyy = now.getFullYear();
    for (const h of rows) {
      const [hy, hm, hd] = h.date.split('-').map(Number);
      const match = h.recurring
        ? hm === mm && hd === dd
        : hy === yyyy && hm === mm && hd === dd;
      if (match) return { destType: h.destType, destValue: h.destValue };
    }
    return null;
  }

  /** Evaluate a time condition against `now`, returning the branch target. */
  async evaluateCondition(id: string, now: Date): Promise<RouteTarget> {
    const cond = await this.findCondition(id);
    const group = await this.findGroup(cond.timeGroupId);
    const inside = group.ranges.some((r) => this.rangeMatches(r, now));
    return inside
      ? { destType: cond.matchDestType, destValue: cond.matchDestValue }
      : { destType: cond.noMatchDestType, destValue: cond.noMatchDestValue };
  }

  /** True when `now` satisfies every non-null dimension of a range. */
  private rangeMatches(r: TimeGroupRange, now: Date): boolean {
    const dow = now.getDay(); // 0..6
    const minutes = now.getHours() * 60 + now.getMinutes();
    const dom = now.getDate(); // 1..31
    const month = now.getMonth() + 1; // 1..12

    if (!this.inWrapRange(dow, r.weekdayStart, r.weekdayEnd, 0, 6)) return false;
    if (!this.inWrapRange(dom, r.monthDayStart, r.monthDayEnd, 1, 31)) return false;
    if (!this.inWrapRange(month, r.monthStart, r.monthEnd, 1, 12)) return false;
    if (r.timeStart != null && r.timeEnd != null) {
      const start = this.toMinutes(r.timeStart);
      const end = this.toMinutes(r.timeEnd);
      // Inclusive start, exclusive end; supports overnight (start > end).
      const ok = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
      if (!ok) return false;
    }
    return true;
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Inclusive range check that supports wrap-around (e.g. Fri..Mon). */
  private inWrapRange(
    value: number,
    start: number | null,
    end: number | null,
    _min: number,
    _max: number,
  ): boolean {
    if (start == null || end == null) return true;
    return start <= end
      ? value >= start && value <= end
      : value >= start || value <= end;
  }
}
