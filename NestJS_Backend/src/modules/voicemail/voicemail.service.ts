import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PsAor, PsEndpoint, VoicemailBox } from '../../database/entities';
import { CreateVoicemailDto, UpdateVoicemailDto } from './dto/voicemail.dto';
import { assertSafeNumber, sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  PaginationDto,
  paginate,
} from '../../common/dto/pagination.dto';

/**
 * Owns voicemail mailboxes (the Asterisk `voicemail` realtime table) plus MWI
 * wiring: when a mailbox matches an extension, its ps_endpoints/ps_aors
 * `mailboxes` field is set to `<mailbox>@<context>` so message-waiting works.
 * voicemail-to-email is just `email` + `attach='yes'` on the row.
 */
@Injectable()
export class VoicemailService {
  private readonly logger = new Logger(VoicemailService.name);

  constructor(
    @InjectRepository(VoicemailBox)
    private readonly repo: Repository<VoicemailBox>,
    private readonly dataSource: DataSource,
  ) {}

  private mwiValue(mailbox: string, context: string): string {
    return `${mailbox}@${context}`;
  }

  /** Best-effort MWI link on the matching PJSIP endpoint/aor (if any). */
  private async setEndpointMailbox(
    mailbox: string,
    value: string | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      const endpoint = await mgr.getRepository(PsEndpoint).findOne({
        where: { id: mailbox },
      });
      if (!endpoint) return; // mailbox not tied to a local extension
      await mgr.getRepository(PsEndpoint).update(mailbox, { mailboxes: value });
      await mgr.getRepository(PsAor).update(mailbox, { mailboxes: value });
    });
  }

  async create(dto: CreateVoicemailDto): Promise<VoicemailBox> {
    const mailbox = assertSafeNumber(dto.mailbox, 'mailbox');
    const context = dto.context ? sanitizeText(dto.context, 80) : 'default';

    const existing = await this.repo.findOne({ where: { mailbox, context } });
    if (existing) {
      throw new ConflictException(
        `Mailbox ${mailbox}@${context} already exists`,
      );
    }

    const box = this.repo.create({
      mailbox,
      context,
      password: assertSafeNumber(dto.pin, 'pin'),
      fullname: dto.fullName ? sanitizeText(dto.fullName, 150) : null,
      email: dto.email ?? null,
      attach: dto.attachToEmail ? 'yes' : 'no',
      deletevoicemail: dto.deleteAfterEmail ? 1 : 0,
      tz: dto.timezone ? sanitizeText(dto.timezone, 40) : null,
      maxmsg: dto.maxMessages ?? 100,
    });
    const saved = await this.repo.save(box);
    await this.setEndpointMailbox(mailbox, this.mwiValue(mailbox, context));
    this.logger.log(`Voicemail ${mailbox}@${context} created`);
    return saved;
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<VoicemailBox>> {
    const { page, limit, search } = query;
    const [data, total] = await this.repo.findAndCount({
      where: search ? { mailbox: ILike(`%${search}%`) } : {},
      order: { mailbox: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(uniqueid: number): Promise<VoicemailBox> {
    const box = await this.repo.findOne({ where: { uniqueid } });
    if (!box) throw new NotFoundException('Mailbox not found');
    return box;
  }

  async update(
    uniqueid: number,
    dto: UpdateVoicemailDto,
  ): Promise<VoicemailBox> {
    const box = await this.findOne(uniqueid);
    const patch: Partial<VoicemailBox> = {};

    if (dto.pin !== undefined) patch.password = assertSafeNumber(dto.pin, 'pin');
    if (dto.fullName !== undefined) {
      patch.fullname = dto.fullName ? sanitizeText(dto.fullName, 150) : null;
    }
    if (dto.email !== undefined) patch.email = dto.email ?? null;
    if (dto.attachToEmail !== undefined) {
      patch.attach = dto.attachToEmail ? 'yes' : 'no';
    }
    if (dto.deleteAfterEmail !== undefined) {
      patch.deletevoicemail = dto.deleteAfterEmail ? 1 : 0;
    }
    if (dto.timezone !== undefined) {
      patch.tz = dto.timezone ? sanitizeText(dto.timezone, 40) : null;
    }
    if (dto.maxMessages !== undefined) patch.maxmsg = dto.maxMessages;

    await this.repo.update(uniqueid, patch);
    this.logger.log(`Voicemail ${box.mailbox}@${box.context} updated`);
    return this.findOne(uniqueid);
  }

  async remove(uniqueid: number): Promise<void> {
    const box = await this.findOne(uniqueid);
    await this.repo.delete(uniqueid);
    await this.setEndpointMailbox(box.mailbox, null);
    this.logger.log(`Voicemail ${box.mailbox}@${box.context} removed`);
  }
}
