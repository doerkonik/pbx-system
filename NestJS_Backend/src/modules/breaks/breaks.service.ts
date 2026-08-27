import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AgentStatusLog, BreakReasonConfig } from '../../database/entities';
import { TelephonyService } from '../../telephony/telephony.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AgentPresence, UserRole } from '../../common/enums';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination.dto';
import {
  BreakHistoryQueryDto,
  CreateBreakReasonDto,
  EndBreakDto,
  StartBreakDto,
  UpdateBreakReasonDto,
} from './dto/break.dto';

/**
 * Break / queue-pause management with the DUAL-WRITE pattern: every state change
 * is applied to Asterisk (via QueuePause) AND recorded in agent_status_log,
 * which is the source of truth for break-reason reporting. The AMI action runs
 * first — if it throws, no log row is written / closed.
 */
@Injectable()
export class BreaksService {
  private readonly logger = new Logger(BreaksService.name);

  constructor(
    @InjectRepository(AgentStatusLog)
    private readonly statusRepo: Repository<AgentStatusLog>,
    @InjectRepository(BreakReasonConfig)
    private readonly reasonRepo: Repository<BreakReasonConfig>,
    private readonly telephony: TelephonyService,
  ) {}

  private requireExtension(user: AuthenticatedUser): string {
    if (!user.extension) {
      throw new ForbiddenException(
        'No extension is associated with this account',
      );
    }
    return user.extension;
  }

  private findOpen(agentId: string): Promise<AgentStatusLog | null> {
    return this.statusRepo.findOne({
      where: { agentId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
  }

  async start(
    user: AuthenticatedUser,
    dto: StartBreakDto,
  ): Promise<AgentStatusLog> {
    const ext = this.requireExtension(user);

    const existing = await this.findOpen(user.sub);
    if (existing) {
      throw new BadRequestException('A break is already open for this agent');
    }

    // Reason must be a configured, active break reason.
    const reason = await this.reasonRepo.findOne({
      where: { code: dto.reason, isActive: true },
    });
    if (!reason) {
      throw new BadRequestException(
        `"${dto.reason}" is not an active break reason`,
      );
    }

    // AMI first — if pausing fails we must NOT record a break.
    await this.telephony.pauseAgent(`PJSIP/${ext}`, reason.code, dto.queue);

    const row = this.statusRepo.create({
      agentId: user.sub,
      extension: ext,
      status: AgentPresence.PAUSED,
      reason: dto.reason,
      startedAt: new Date(),
      endedAt: null,
      durationSec: null,
    });
    const saved = await this.statusRepo.save(row);
    this.logger.log(`Break started for ${ext} (${dto.reason})`);
    return saved;
  }

  async end(
    user: AuthenticatedUser,
    dto: EndBreakDto,
  ): Promise<AgentStatusLog> {
    const ext = this.requireExtension(user);

    const open = await this.findOpen(user.sub);
    if (!open) {
      throw new BadRequestException('No open break to end');
    }

    // AMI first — surface unpause failures without closing the log row.
    await this.telephony.unpauseAgent(`PJSIP/${ext}`, dto.queue);

    const now = new Date();
    open.endedAt = now;
    open.durationSec = Math.max(
      0,
      Math.floor((now.getTime() - open.startedAt.getTime()) / 1000),
    );
    const saved = await this.statusRepo.save(open);
    this.logger.log(`Break ended for ${ext} (${open.durationSec}s)`);
    return saved;
  }

  async current(user: AuthenticatedUser): Promise<AgentStatusLog | null> {
    return this.findOpen(user.sub);
  }

  /** Active reasons an agent may pick, ordered for display. */
  reasons(): Promise<BreakReasonConfig[]> {
    return this.reasonRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
  }

  // ==========================================================================
  //  Break-reason configuration (admin)
  // ==========================================================================

  listReasons(): Promise<BreakReasonConfig[]> {
    return this.reasonRepo.find({ order: { sortOrder: 'ASC', label: 'ASC' } });
  }

  async createReason(dto: CreateBreakReasonDto): Promise<BreakReasonConfig> {
    const exists = await this.reasonRepo.findOne({ where: { code: dto.code } });
    if (exists) {
      throw new ConflictException(`Break reason "${dto.code}" already exists`);
    }
    const row = this.reasonRepo.create({
      code: dto.code,
      label: dto.label,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.reasonRepo.save(row);
    this.logger.log(`Break reason created: ${saved.code}`);
    return saved;
  }

  async updateReason(
    id: string,
    dto: UpdateBreakReasonDto,
  ): Promise<BreakReasonConfig> {
    const row = await this.reasonRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Break reason not found');

    if (dto.code && dto.code !== row.code) {
      const clash = await this.reasonRepo.findOne({
        where: { code: dto.code },
      });
      if (clash) {
        throw new ConflictException(`Break reason "${dto.code}" already exists`);
      }
    }
    Object.assign(row, {
      code: dto.code ?? row.code,
      label: dto.label ?? row.label,
      isActive: dto.isActive ?? row.isActive,
      sortOrder: dto.sortOrder ?? row.sortOrder,
    });
    return this.reasonRepo.save(row);
  }

  async removeReason(id: string): Promise<void> {
    const res = await this.reasonRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Break reason not found');
  }

  async history(
    user: AuthenticatedUser,
    query: BreakHistoryQueryDto,
  ): Promise<PaginatedResult<AgentStatusLog>> {
    const { page, limit, agentId } = query;

    let targetAgentId = user.sub;
    if (agentId && agentId !== user.sub) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'You may only view your own break history',
        );
      }
      targetAgentId = agentId;
    }

    const [data, total] = await this.statusRepo.findAndCount({
      where: { agentId: targetAgentId },
      order: { startedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }
}
