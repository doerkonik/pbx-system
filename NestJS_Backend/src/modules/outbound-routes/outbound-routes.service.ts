import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import { OutboundRoute, Trunk } from '../../database/entities';
import {
  CreateOutboundRouteDto,
  UpdateOutboundRouteDto,
} from './dto/outbound-route.dto';
import { assertSafeDialToken, assertSafeNumber } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/**
 * Owns outbound routing config. Route matching is executed live by the Asterisk
 * dialplan on VM1; this module is the source of truth for the config plus a
 * `resolve` helper that mirrors the dialplan's selection logic for admin testing.
 */
@Injectable()
export class OutboundRoutesService {
  private readonly logger = new Logger(OutboundRoutesService.name);

  constructor(
    @InjectRepository(OutboundRoute)
    private readonly routeRepo: Repository<OutboundRoute>,
    @InjectRepository(Trunk)
    private readonly trunkRepo: Repository<Trunk>,
  ) {}

  async create(dto: CreateOutboundRouteDto): Promise<OutboundRoute> {
    assertSafeDialToken(dto.pattern, 'pattern');
    if (dto.prefix) assertSafeDialToken(dto.prefix, 'prefix');
    await this.assertTrunksExist(dto.trunkIds);

    const route = this.routeRepo.create({
      name: dto.name,
      pattern: dto.pattern,
      prefix: dto.prefix ?? null,
      stripDigits: dto.stripDigits ?? 0,
      callerIdOverride: dto.callerIdOverride ?? null,
      priority: dto.priority ?? 0,
      trunkIds: dto.trunkIds,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.routeRepo.save(route);
    this.logger.log(`Outbound route ${saved.name} created`);
    return saved;
  }

  async findAll(
    query: PaginationDto,
  ): Promise<PaginatedResult<OutboundRoute>> {
    const { page, limit, search } = query;
    const [data, total] = await this.routeRepo.findAndCount({
      where: search
        ? [
            { name: ILike(`%${search}%`) },
            { pattern: ILike(`%${search}%`) },
          ]
        : {},
      order: { priority: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<OutboundRoute> {
    const route = await this.routeRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Outbound route not found');
    return route;
  }

  async update(
    id: string,
    dto: UpdateOutboundRouteDto,
  ): Promise<OutboundRoute> {
    const route = await this.findOne(id);
    if (dto.pattern) assertSafeDialToken(dto.pattern, 'pattern');
    if (dto.prefix) assertSafeDialToken(dto.prefix, 'prefix');
    if (dto.trunkIds) await this.assertTrunksExist(dto.trunkIds);

    await this.routeRepo.update(id, {
      name: dto.name ?? route.name,
      pattern: dto.pattern ?? route.pattern,
      prefix: dto.prefix ?? route.prefix,
      stripDigits: dto.stripDigits ?? route.stripDigits,
      callerIdOverride:
        dto.callerIdOverride !== undefined
          ? dto.callerIdOverride
          : route.callerIdOverride,
      priority: dto.priority ?? route.priority,
      trunkIds: dto.trunkIds ?? route.trunkIds,
      isActive: dto.isActive ?? route.isActive,
    });
    this.logger.log(`Outbound route ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.routeRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Outbound route not found');
    this.logger.log(`Outbound route ${id} deleted`);
  }

  /**
   * Returns the active route that would handle a dialed number, mirroring the
   * dialplan: active routes ordered by priority (then name), first match wins.
   */
  async resolve(number: string): Promise<OutboundRoute> {
    const dialed = assertSafeNumber(number, 'number');
    const routes = await this.routeRepo.find({
      where: { isActive: true },
      order: { priority: 'ASC', name: 'ASC' },
    });
    const match = routes.find((r) => this.matchesRoute(dialed, r));
    if (!match) {
      throw new NotFoundException(
        `No active outbound route matches ${dialed}`,
      );
    }
    return match;
  }

  // ==========================================================================
  //  Helpers
  // ==========================================================================

  private async assertTrunksExist(trunkIds: string[]): Promise<void> {
    const unique = [...new Set(trunkIds)];
    if (unique.length === 0) {
      throw new BadRequestException('trunkIds must reference at least one trunk');
    }
    const found = await this.trunkRepo.find({ where: { id: In(unique) } });
    if (found.length !== unique.length) {
      const foundIds = new Set(found.map((t) => t.id));
      const missing = unique.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Unknown trunk id(s): ${missing.join(', ')}`,
      );
    }
  }

  private matchesRoute(number: string, route: OutboundRoute): boolean {
    if (route.prefix && !number.startsWith(route.prefix)) return false;
    return this.matchesPattern(number, route.pattern);
  }

  /**
   * Translates an Asterisk dial pattern into a regex and tests it. Supports the
   * standard classes: X=[0-9], Z=[1-9], N=[2-9], `.`/`!`=wildcards, `[..]` sets,
   * and literal digits. A leading `_` (pattern marker) is stripped. Non-pattern
   * strings are treated as an exact match.
   */
  private matchesPattern(number: string, pattern: string): boolean {
    const p = pattern.startsWith('_') ? pattern.slice(1) : pattern;

    // No pattern metacharacters → exact literal comparison.
    if (!/[XZN.!\[\]]/.test(p) && !pattern.startsWith('_')) {
      return number === pattern;
    }

    let regex = '^';
    for (let i = 0; i < p.length; i++) {
      const ch = p[i];
      switch (ch) {
        case 'X':
          regex += '[0-9]';
          break;
        case 'Z':
          regex += '[1-9]';
          break;
        case 'N':
          regex += '[2-9]';
          break;
        case '.':
        case '!':
          regex += '.*';
          break;
        case '[': {
          const end = p.indexOf(']', i);
          if (end === -1) return false;
          regex += p.slice(i, end + 1);
          i = end;
          break;
        }
        case '+':
        case '*':
        case '#':
          regex += `\\${ch}`;
          break;
        default:
          regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
    regex += '$';
    try {
      return new RegExp(regex).test(number);
    } catch {
      return false;
    }
  }
}
