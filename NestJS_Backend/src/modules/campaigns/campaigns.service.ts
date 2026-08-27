import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign, CampaignContact } from '../../database/entities';
import { TelephonyService } from '../../telephony/telephony.service';
import {
  CampaignContactStatus,
  CampaignStatus,
} from '../../common/enums';
import { assertSafeNumber, sanitizeText } from '../../common/utils/asterisk-sanitize';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  AddContactsDto,
  ContactOutcomeDto,
  CreateCampaignDto,
  SetCampaignStatusDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

/**
 * Preview-mode outbound dialer. Admins/supervisors build campaigns + load
 * contacts; agents pull the next contact and click-to-dial from their own
 * device. Progressive/predictive pacing is intentionally out of scope here.
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaigns: Repository<Campaign>,
    @InjectRepository(CampaignContact)
    private readonly contacts: Repository<CampaignContact>,
    private readonly telephony: TelephonyService,
  ) {}

  /* ------------------------- Campaign config --------------------------- */

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const entity = this.campaigns.create({
      name: sanitizeText(dto.name, 120),
      mode: dto.mode ?? 'preview',
      callerId: dto.callerId ? assertSafeNumber(dto.callerId, 'callerId') : null,
      status: CampaignStatus.DRAFT,
    });
    const saved = await this.campaigns.save(entity);
    this.logger.log(`Campaign ${saved.name} created`);
    return saved;
  }

  findAll(): Promise<Campaign[]> {
    return this.campaigns.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Campaign> {
    const entity = await this.campaigns.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Campaign not found');
    return entity;
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const entity = await this.findOne(id);
    if (dto.name !== undefined) entity.name = sanitizeText(dto.name, 120);
    if (dto.mode !== undefined) entity.mode = dto.mode;
    if (dto.callerId !== undefined) {
      entity.callerId = dto.callerId
        ? assertSafeNumber(dto.callerId, 'callerId')
        : null;
    }
    return this.campaigns.save(entity);
  }

  async setStatus(id: string, dto: SetCampaignStatusDto): Promise<Campaign> {
    const entity = await this.findOne(id);
    entity.status = dto.status;
    this.logger.log(`Campaign ${id} -> ${dto.status}`);
    return this.campaigns.save(entity);
  }

  async remove(id: string): Promise<void> {
    const res = await this.campaigns.delete(id);
    if (!res.affected) throw new NotFoundException('Campaign not found');
  }

  /* ----------------------------- Contacts ------------------------------ */

  async addContacts(
    campaignId: string,
    dto: AddContactsDto,
  ): Promise<{ added: number }> {
    await this.findOne(campaignId);
    const rows = dto.contacts.map((c) =>
      this.contacts.create({
        campaignId,
        phone: assertSafeNumber(c.phone, 'phone'),
        name: c.name ? sanitizeText(c.name, 120) : null,
        attributes: c.attributes ?? {},
        status: CampaignContactStatus.PENDING,
      }),
    );
    await this.contacts.save(rows, { chunk: 500 });
    this.logger.log(`Added ${rows.length} contacts to campaign ${campaignId}`);
    return { added: rows.length };
  }

  async stats(campaignId: string): Promise<Record<string, number>> {
    await this.findOne(campaignId);
    const rows = await this.contacts
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('c.campaignId = :campaignId', { campaignId })
      .groupBy('c.status')
      .getRawMany<{ status: string; count: string }>();
    const out: Record<string, number> = {
      pending: 0,
      assigned: 0,
      done: 0,
      dnc: 0,
    };
    for (const r of rows) out[r.status] = Number(r.count);
    return out;
  }

  /* ------------------------- Agent preview flow ------------------------ */

  /** Assign the next pending contact to the requesting agent. */
  async nextForAgent(
    campaignId: string,
    user: AuthenticatedUser,
  ): Promise<CampaignContact | null> {
    const campaign = await this.findOne(campaignId);
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('Campaign is not active');
    }

    // Return any contact still held by this agent before handing out a new one.
    const held = await this.contacts.findOne({
      where: {
        campaignId,
        assignedAgentId: user.sub,
        status: CampaignContactStatus.ASSIGNED,
      },
      order: { updatedAt: 'ASC' },
    });
    if (held) return held;

    const next = await this.contacts.findOne({
      where: { campaignId, status: CampaignContactStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
    if (!next) return null;

    // Atomic claim: only assign if still pending (guards concurrent pulls).
    const res = await this.contacts.update(
      { id: next.id, status: CampaignContactStatus.PENDING },
      {
        status: CampaignContactStatus.ASSIGNED,
        assignedAgentId: user.sub,
      },
    );
    if (!res.affected) return this.nextForAgent(campaignId, user);
    return this.contacts.findOne({ where: { id: next.id } });
  }

  /** Click-to-dial the assigned contact from the agent's own device. */
  async dial(
    contactId: string,
    user: AuthenticatedUser,
  ): Promise<{ actionId: string }> {
    if (!user.extension) {
      throw new ForbiddenException('No extension associated with this account');
    }
    const contact = await this.getOwnedContact(contactId, user);
    const campaign = await this.findOne(contact.campaignId);

    const { actionId } = await this.telephony.originateCall({
      fromExtension: user.extension,
      to: contact.phone,
      callerId: campaign.callerId ?? undefined,
    });

    contact.attempts += 1;
    contact.lastUniqueid = actionId || contact.lastUniqueid;
    await this.contacts.save(contact);
    this.logger.log(
      `Preview dial ${user.extension} -> ${contact.phone} (campaign ${campaign.name})`,
    );
    return { actionId };
  }

  /** Record a terminal outcome for the agent's assigned contact. */
  async outcome(
    contactId: string,
    user: AuthenticatedUser,
    dto: ContactOutcomeDto,
  ): Promise<CampaignContact> {
    const contact = await this.getOwnedContact(contactId, user);
    contact.status = dto.status;
    contact.assignedAgentId = null;
    return this.contacts.save(contact);
  }

  private async getOwnedContact(
    contactId: string,
    user: AuthenticatedUser,
  ): Promise<CampaignContact> {
    const contact = await this.contacts.findOne({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found');
    if (contact.assignedAgentId && contact.assignedAgentId !== user.sub) {
      throw new ForbiddenException('Contact is assigned to another agent');
    }
    return contact;
  }
}
