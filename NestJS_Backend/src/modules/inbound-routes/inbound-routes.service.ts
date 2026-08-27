import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { InboundRoute } from '../../database/entities';
import {
  CreateInboundRouteDto,
  UpdateInboundRouteDto,
} from './dto/inbound-route.dto';
import { RouteDestinationType } from '../../common/enums';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';
import { assertRouteDest } from '../../common/utils/route-destination';
import {
  RouteTarget,
  TimeRoutingService,
} from '../time-routing/time-routing.service';

/** A fully-resolved inbound destination (time conditions/holidays followed). */
export interface ResolvedInbound extends RouteTarget {
  matchedRouteId: string | null;
  /** Trail of hops taken while following time conditions (for debugging/UI). */
  trail: string[];
}

/**
 * Inbound routing rules + the call-time resolver. The telephony module calls
 * `resolve(did, cid)` at Stasis entry to decide where an inbound call goes.
 * Time conditions and holidays are evaluated in Node here so config edits apply
 * with no Asterisk reload.
 */
@Injectable()
export class InboundRoutesService {
  private readonly logger = new Logger(InboundRoutesService.name);
  private static readonly MAX_HOPS = 5;

  constructor(
    @InjectRepository(InboundRoute)
    private readonly repo: Repository<InboundRoute>,
    private readonly timeRouting: TimeRoutingService,
  ) {}

  async create(dto: CreateInboundRouteDto): Promise<InboundRoute> {
    const entity = this.repo.create({
      name: sanitizeText(dto.name, 80),
      didNumber: dto.didNumber ? sanitizeText(dto.didNumber, 40) : null,
      cidPattern: dto.cidPattern ? sanitizeText(dto.cidPattern, 80) : null,
      destType: dto.destType,
      destValue: assertRouteDest(dto.destType, dto.destValue),
      fallbackDestType: dto.fallbackDestType ?? null,
      fallbackDestValue: dto.fallbackDestType
        ? assertRouteDest(dto.fallbackDestType, dto.fallbackDestValue, 'fallbackDest')
        : null,
      priority: dto.priority ?? 0,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Inbound route ${saved.name} created`);
    return saved;
  }

  findAll(): Promise<InboundRoute[]> {
    return this.repo.find({ order: { priority: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<InboundRoute> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Inbound route not found');
    return entity;
  }

  async update(id: string, dto: UpdateInboundRouteDto): Promise<InboundRoute> {
    const entity = await this.findOne(id);
    const destType = dto.destType ?? entity.destType;
    const fallbackDestType =
      dto.fallbackDestType !== undefined
        ? dto.fallbackDestType
        : (entity.fallbackDestType as RouteDestinationType | null);

    await this.repo.update(id, {
      name: dto.name !== undefined ? sanitizeText(dto.name, 80) : entity.name,
      didNumber:
        dto.didNumber !== undefined
          ? dto.didNumber
            ? sanitizeText(dto.didNumber, 40)
            : null
          : entity.didNumber,
      cidPattern:
        dto.cidPattern !== undefined
          ? dto.cidPattern
            ? sanitizeText(dto.cidPattern, 80)
            : null
          : entity.cidPattern,
      destType,
      destValue: assertRouteDest(
        destType,
        dto.destValue !== undefined ? dto.destValue : entity.destValue,
      ),
      fallbackDestType: fallbackDestType ?? null,
      fallbackDestValue: fallbackDestType
        ? assertRouteDest(
            fallbackDestType,
            dto.fallbackDestValue !== undefined
              ? dto.fallbackDestValue
              : entity.fallbackDestValue,
            'fallbackDest',
          )
        : null,
      priority: dto.priority ?? entity.priority,
      isActive: dto.isActive ?? entity.isActive,
    });
    this.logger.log(`Inbound route ${id} updated`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Inbound route not found');
    this.logger.log(`Inbound route ${id} removed`);
  }

  /**
   * Resolve an inbound call to a concrete destination. Picks the most specific
   * active matching route (exact DID beats catch-all, then higher priority),
   * then follows any `time_condition` hops (honouring holidays) to a terminal
   * target. `now` is injectable for testing.
   */
  async resolve(
    did: string | null,
    cid?: string | null,
    now: Date = new Date(),
  ): Promise<ResolvedInbound> {
    const route = await this.matchRoute(did, cid);
    if (!route) {
      return {
        matchedRouteId: null,
        destType: RouteDestinationType.HANGUP,
        destValue: null,
        trail: ['no-match'],
      };
    }

    const trail: string[] = [`route:${route.name}`];
    let target: RouteTarget = {
      destType: route.destType,
      destValue: route.destValue,
    };

    // Follow time-condition hops to a terminal destination.
    for (let hop = 0; hop < InboundRoutesService.MAX_HOPS; hop++) {
      if (target.destType !== RouteDestinationType.TIME_CONDITION) break;
      if (!target.destValue) break;

      const holiday = await this.timeRouting.holidayTarget(now);
      if (holiday) {
        trail.push('holiday');
        target = holiday;
        continue;
      }
      trail.push(`tc:${target.destValue}`);
      target = await this.timeRouting.evaluateCondition(target.destValue, now);
    }

    return { matchedRouteId: route.id, trail, ...target };
  }

  /** Most-specific active route for a DID + caller id (or null). */
  private async matchRoute(
    did: string | null,
    cid?: string | null,
  ): Promise<InboundRoute | null> {
    // Exact-DID routes first (highest priority), then catch-all routes.
    const exact = did
      ? await this.repo.find({
          where: { isActive: true, didNumber: did },
          order: { priority: 'DESC', createdAt: 'ASC' },
        })
      : [];
    const catchAll = await this.repo.find({
      where: { isActive: true, didNumber: IsNull() },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    for (const route of [...exact, ...catchAll]) {
      if (this.cidMatches(route.cidPattern, cid)) return route;
    }
    return null;
  }

  /** Simple caller-id match: null pattern = any; else exact match. */
  private cidMatches(pattern: string | null, cid?: string | null): boolean {
    if (!pattern) return true;
    return !!cid && cid === pattern;
  }
}
