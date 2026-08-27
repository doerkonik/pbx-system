import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { DirectMessage, User } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { CHANNELS } from '../../redis/redis.constants';

/**
 * Internal 1:1 messaging (Module 12) — agent↔supervisor chat. Persists each
 * message and pushes it live to both participants' user rooms.
 */
@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectRepository(DirectMessage)
    private readonly repo: Repository<DirectMessage>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly redis: RedisService,
  ) {}

  async send(
    fromUserId: string,
    toUserId: string,
    body: string,
  ): Promise<DirectMessage> {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot message yourself');
    }
    const recipient = await this.users.findOne({ where: { id: toUserId } });
    if (!recipient) throw new NotFoundException('Recipient not found');

    const saved = await this.repo.save(
      this.repo.create({ fromUserId, toUserId, body }),
    );

    // Push to recipient (new message) and echo to sender (multi-device sync).
    for (const uid of [toUserId, fromUserId]) {
      await this.redis.publish(CHANNELS.NOTIFICATION_EVENTS, {
        event: 'message',
        userId: uid,
        data: saved,
      });
    }
    return saved;
  }

  /** Full conversation between two users, oldest first. */
  conversation(userId: string, otherUserId: string, limit = 100): Promise<DirectMessage[]> {
    return this.repo
      .createQueryBuilder('m')
      .where(
        new Brackets((qb) => {
          qb.where('m.fromUserId = :userId AND m.toUserId = :other', {
            userId,
            other: otherUserId,
          }).orWhere('m.fromUserId = :other AND m.toUserId = :userId', {
            userId,
            other: otherUserId,
          });
        }),
      )
      .orderBy('m.createdAt', 'ASC')
      .take(Math.min(limit, 500))
      .getMany();
  }

  /** Mark every message from `otherUserId` to me as read. */
  async markConversationRead(userId: string, otherUserId: string): Promise<void> {
    await this.repo.update(
      { toUserId: userId, fromUserId: otherUserId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { toUserId: userId, readAt: IsNull() } });
  }
}
