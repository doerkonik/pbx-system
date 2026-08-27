import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AgentSession } from '../../database/entities';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination.dto';
import { AgentLoginDto, SessionHistoryQueryDto } from './dto/agent-session.dto';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';

/**
 * Agent login/logout session tracking — the wall-clock a station was manned,
 * distinct from queue pause (breaks). One open session (logout_at NULL) per
 * agent; a fresh login closes any dangling open session first.
 */
@Injectable()
export class AgentSessionsService {
  private readonly logger = new Logger(AgentSessionsService.name);

  constructor(
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
  ) {}

  /**
   * The extension identity for this agent. Requires either a home extension on
   * the account or an explicit hot-desk device to log into.
   */
  private requireExtension(
    user: AuthenticatedUser,
    deviceExtension?: string,
  ): string {
    const ext = user.extension ?? deviceExtension;
    if (!ext) {
      throw new ForbiddenException(
        'No extension is associated with this account',
      );
    }
    return ext;
  }

  private findOpen(agentId: string): Promise<AgentSession | null> {
    return this.sessionRepo.findOne({
      where: { agentId, logoutAt: IsNull() },
      order: { loginAt: 'DESC' },
    });
  }

  private closeSession(session: AgentSession, at: Date): AgentSession {
    session.logoutAt = at;
    session.durationSec = Math.max(
      0,
      Math.floor((at.getTime() - session.loginAt.getTime()) / 1000),
    );
    return session;
  }

  async login(
    user: AuthenticatedUser,
    dto: AgentLoginDto = {},
  ): Promise<AgentSession> {
    const device = dto.deviceExtension
      ? sanitizeText(dto.deviceExtension, 40)
      : undefined;
    // Home identity for reporting; falls back to the hot-desk device when the
    // account has no home extension of its own.
    const homeExt = this.requireExtension(user, device);
    const deviceExt = device ?? user.extension ?? homeExt;
    const now = new Date();

    // Close any dangling open session before opening a fresh one.
    const dangling = await this.findOpen(user.sub);
    if (dangling) {
      await this.sessionRepo.save(this.closeSession(dangling, now));
      this.logger.warn(
        `Closed dangling session ${dangling.id} for ${homeExt} on new login`,
      );
    }

    const session = this.sessionRepo.create({
      agentId: user.sub,
      extension: homeExt,
      deviceExtension: deviceExt,
      loginAt: now,
      logoutAt: null,
      durationSec: null,
    });
    const saved = await this.sessionRepo.save(session);
    this.logger.log(
      `Agent ${homeExt} logged in on device ${deviceExt} (session ${saved.id})`,
    );
    return saved;
  }

  async logout(user: AuthenticatedUser): Promise<AgentSession> {
    const open = await this.findOpen(user.sub);
    if (!open) {
      throw new BadRequestException('No open session to log out of');
    }
    const saved = await this.sessionRepo.save(
      this.closeSession(open, new Date()),
    );
    this.logger.log(
      `Agent ${saved.extension} logged out (${saved.durationSec}s)`,
    );
    return saved;
  }

  async current(user: AuthenticatedUser): Promise<AgentSession | null> {
    return this.findOpen(user.sub);
  }

  async history(
    user: AuthenticatedUser,
    query: SessionHistoryQueryDto,
  ): Promise<PaginatedResult<AgentSession>> {
    const { page, limit, agentId } = query;

    let targetAgentId = user.sub;
    if (agentId && agentId !== user.sub) {
      if (user.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'You may only view your own session history',
        );
      }
      targetAgentId = agentId;
    }

    const [data, total] = await this.sessionRepo.findAndCount({
      where: { agentId: targetAgentId },
      order: { loginAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }
}
