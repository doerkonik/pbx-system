import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueCallback } from '../../database/entities';
import { TelephonyService } from '../../telephony/telephony.service';
import { CallbackStatus } from '../../common/enums';
import { assertSafeNumber, sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  PaginatedResult,
  paginate,
} from '../../common/dto/pagination.dto';
import {
  CreateQueueCallbackDto,
  ListQueueCallbackQueryDto,
} from './dto/callback.dto';

/**
 * Queue callbacks (Module 2): store a caller's request to be called back
 * instead of holding, and let staff dial/cancel them. Dialing originates the
 * customer and reconnects them to the queue via TelephonyService.
 */
@Injectable()
export class CallbacksService {
  private readonly logger = new Logger(CallbacksService.name);

  constructor(
    @InjectRepository(QueueCallback)
    private readonly repo: Repository<QueueCallback>,
    private readonly telephony: TelephonyService,
  ) {}

  async create(dto: CreateQueueCallbackDto): Promise<QueueCallback> {
    const entity = this.repo.create({
      queueName: sanitizeText(dto.queueName, 128),
      phone: assertSafeNumber(dto.phone, 'phone'),
      callerName: dto.callerName ? sanitizeText(dto.callerName, 120) : null,
      priority: dto.priority ?? 0,
      status: CallbackStatus.PENDING,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Callback queued for ${saved.phone} on ${saved.queueName}`);
    return saved;
  }

  async findAll(
    query: ListQueueCallbackQueryDto,
  ): Promise<PaginatedResult<QueueCallback>> {
    const { page, limit, queueName, status } = query;
    const where: Record<string, unknown> = {};
    if (queueName) where.queueName = queueName;
    if (status) where.status = status;
    const [data, total] = await this.repo.findAndCount({
      where,
      // Highest priority first, then oldest request.
      order: { priority: 'DESC', createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, page, limit);
  }

  async findOne(id: string): Promise<QueueCallback> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Callback not found');
    return entity;
  }

  /** Originate the callback and connect the customer to the queue. */
  async dial(id: string): Promise<QueueCallback> {
    const cb = await this.findOne(id);
    if (cb.status === CallbackStatus.DONE || cb.status === CallbackStatus.CANCELLED) {
      throw new BadRequestException(`Callback is already ${cb.status}`);
    }
    cb.attempts += 1;
    cb.lastAttemptAt = new Date();
    cb.status = CallbackStatus.DIALING;
    try {
      const { actionId } = await this.telephony.originateCallback({
        phone: cb.phone,
        queue: cb.queueName,
        callerId: cb.callerName ?? undefined,
      });
      cb.lastUniqueid = actionId || cb.lastUniqueid;
    } catch (err) {
      cb.status = CallbackStatus.FAILED;
      await this.repo.save(cb);
      throw new BadRequestException(
        `Callback dial failed: ${(err as Error).message}`,
      );
    }
    return this.repo.save(cb);
  }

  async setStatus(id: string, status: CallbackStatus): Promise<QueueCallback> {
    const cb = await this.findOne(id);
    cb.status = status;
    return this.repo.save(cb);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Callback not found');
  }
}
