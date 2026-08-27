import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PsAuth, Extension, Cdr } from '../../database/entities';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

/** A dialable directory entry (colleague extension) for click-to-call. */
export interface DirectoryEntry {
  extension: string;
  name: string;
  department: string | null;
}

/** One row of the agent's personal call history. */
export interface CallLogEntry {
  id: number;
  direction: 'inbound' | 'outbound';
  /** The other party's number (not the agent). */
  party: string;
  /** Caller-id name if Asterisk captured one. */
  name: string;
  at: Date | null;
  /** Talk time in seconds (billsec). 0 for unanswered. */
  durationSec: number;
  disposition: string;
  missed: boolean;
}

/**
 * Serves the authenticated user their OWN WebRTC/SIP credentials so the browser
 * softphone (SIP.js) can register directly to Asterisk over WSS, plus two
 * agent-scoped read endpoints the softphone UI needs:
 *
 *  - GET /softphone/directory  — dialable colleague extensions (click-to-call)
 *  - GET /softphone/call-logs  — the caller's OWN recent call history
 *
 * CDR and the extensions admin API are admin-only; these endpoints deliberately
 * expose only the narrow, self-scoped slice an agent's softphone requires — a
 * call log filtered to the agent's own extension, and a name/number directory
 * with no secrets. See DECISIONS.md ("Softphone credential delivery").
 */
@Roles(UserRole.ADMIN, UserRole.AGENT)
@Controller('softphone')
export class SoftphoneController {
  constructor(
    @InjectRepository(PsAuth) private readonly authRepo: Repository<PsAuth>,
    @InjectRepository(Extension)
    private readonly extRepo: Repository<Extension>,
    @InjectRepository(Cdr) private readonly cdrRepo: Repository<Cdr>,
  ) {}

  @Get('credentials')
  async credentials(@CurrentUser() user: AuthenticatedUser) {
    if (!user.extension) {
      throw new ForbiddenException(
        'No extension is assigned to this account; softphone unavailable',
      );
    }
    const auth = await this.authRepo.findOne({
      where: { id: user.extension },
    });
    if (!auth || !auth.password) {
      throw new NotFoundException(
        'SIP credentials not found for this extension',
      );
    }
    return {
      extension: user.extension,
      username: auth.username ?? user.extension,
      password: auth.password,
    };
  }

  /**
   * Company directory of dialable extensions (everyone but the caller). Names
   * only — never SIP secrets. Used by the softphone's Contacts tab.
   */
  @Get('directory')
  async directory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DirectoryEntry[]> {
    const rows = await this.extRepo.find({
      where: user.extension
        ? { isActive: true, extensionNumber: Not(user.extension) }
        : { isActive: true },
      order: { extensionNumber: 'ASC' },
    });
    return rows.map((e) => ({
      extension: e.extensionNumber,
      name: e.displayName || e.extensionNumber,
      department: e.department ?? null,
    }));
  }

  /**
   * The authenticated agent's OWN recent calls (most recent first). Strictly
   * scoped: only rows where the agent's extension is the source or destination.
   */
  @Get('call-logs')
  async callLogs(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CallLogEntry[]> {
    if (!user.extension) return [];
    const ext = user.extension;
    const rows = await this.cdrRepo
      .createQueryBuilder('c')
      .where('c.src = :ext OR c.dst = :ext', { ext })
      .orderBy('c.calldate', 'DESC')
      .limit(50)
      .getMany();

    return rows.map((c) => {
      const outbound = c.src === ext;
      const party = outbound ? c.dst : c.src;
      const answered = c.disposition?.toUpperCase() === 'ANSWERED';
      return {
        id: c.id,
        direction: outbound ? 'outbound' : 'inbound',
        party,
        name: this.callerName(c.clid) || party,
        at: c.calldate,
        durationSec: c.billsec ?? 0,
        disposition: c.disposition,
        missed: !outbound && !answered,
      };
    });
  }

  /** Extract a display name from an Asterisk clid like `"Alice" <1001>`. */
  private callerName(clid: string): string {
    const m = clid?.match(/"([^"]*)"/);
    return m?.[1]?.trim() ?? '';
  }
}
