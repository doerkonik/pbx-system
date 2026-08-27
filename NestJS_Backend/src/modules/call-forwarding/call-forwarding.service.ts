import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallForwarding } from '../../database/entities';
import { SetCallForwardingDto } from './dto/call-forwarding.dto';
import { UserRole } from '../../common/enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  assertSafeAsteriskId,
  assertSafeNumber,
} from '../../common/utils/asterisk-sanitize';

/**
 * Per-extension call forwarding. This is app config only: the dialplan on VM1
 * reads the `call_forwarding` rows to apply Dial hints (documented separately).
 *
 * Authorization: admins manage any extension; an agent may only manage the
 * extension they own (enforced per-operation since the controller is reachable
 * by both roles).
 */
@Injectable()
export class CallForwardingService {
  private readonly logger = new Logger(CallForwardingService.name);

  constructor(
    @InjectRepository(CallForwarding)
    private readonly cfRepo: Repository<CallForwarding>,
  ) {}

  /** Agents may act only on their own extension; admins on any. */
  private authorize(user: AuthenticatedUser, extensionNumber: string): void {
    if (
      user.role === UserRole.AGENT &&
      user.extension !== extensionNumber
    ) {
      throw new ForbiddenException(
        'Agents may only manage forwarding for their own extension',
      );
    }
  }

  async get(
    user: AuthenticatedUser,
    extensionNumber: string,
  ): Promise<CallForwarding> {
    const ext = assertSafeAsteriskId(extensionNumber, 'extensionNumber');
    this.authorize(user, ext);

    const existing = await this.cfRepo.findOne({
      where: { extensionNumber: ext },
    });
    if (existing) return existing;

    // No row yet — surface a well-formed "disabled" default (not persisted).
    const def = this.cfRepo.create({
      extensionNumber: ext,
      enabled: false,
      forwardTo: null,
      forwardType: 'unconditional',
    });
    return def;
  }

  async set(
    user: AuthenticatedUser,
    extensionNumber: string,
    dto: SetCallForwardingDto,
  ): Promise<CallForwarding> {
    const ext = assertSafeAsteriskId(extensionNumber, 'extensionNumber');
    this.authorize(user, ext);

    let forwardTo: string | null = null;
    if (dto.enabled) {
      if (!dto.forwardTo || dto.forwardTo.trim().length === 0) {
        throw new BadRequestException(
          'forwardTo is required when forwarding is enabled',
        );
      }
      forwardTo = assertSafeNumber(dto.forwardTo, 'forwardTo');
    } else if (dto.forwardTo) {
      // Keep a validated target even while disabled, if one was provided.
      forwardTo = assertSafeNumber(dto.forwardTo, 'forwardTo');
    }

    const forwardType = dto.forwardType ?? 'unconditional';

    let row = await this.cfRepo.findOne({ where: { extensionNumber: ext } });
    if (!row) {
      row = this.cfRepo.create({ extensionNumber: ext });
    }
    row.enabled = dto.enabled;
    row.forwardTo = forwardTo;
    row.forwardType = forwardType;

    const saved = await this.cfRepo.save(row);
    this.logger.log(
      `Call forwarding for ${ext} set (enabled=${saved.enabled}, type=${saved.forwardType})`,
    );
    return saved;
  }

  async clear(
    user: AuthenticatedUser,
    extensionNumber: string,
  ): Promise<void> {
    const ext = assertSafeAsteriskId(extensionNumber, 'extensionNumber');
    this.authorize(user, ext);

    const row = await this.cfRepo.findOne({ where: { extensionNumber: ext } });
    if (!row) {
      throw new NotFoundException(
        `No call forwarding configured for extension ${ext}`,
      );
    }
    await this.cfRepo.delete({ extensionNumber: ext });
    this.logger.log(`Call forwarding for ${ext} cleared`);
  }
}
