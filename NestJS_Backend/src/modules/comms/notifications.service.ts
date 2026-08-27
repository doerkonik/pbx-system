import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification, User } from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { CHANNELS } from '../../redis/redis.constants';
import { EmailService } from './email.service';
import { CreateNotificationDto } from './dto/comms.dto';

/**
 * In-app + email notifications (Module 12). Persists a row, pushes it live to
 * the recipient's user room via the notification.events Redis channel, and
 * optionally emails them. Other modules call `notify()` (e.g. SLA alerts).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}

  async notify(dto: CreateNotificationDto): Promise<Notification> {
    const saved = await this.repo.save(
      this.repo.create({
        userId: dto.userId ?? null,
        type: dto.type ?? 'info',
        title: dto.title,
        body: dto.body ?? null,
        link: dto.link ?? null,
      }),
    );

    // Live push: to the recipient's room, or broadcast when userId is null.
    await this.redis.publish(CHANNELS.NOTIFICATION_EVENTS, {
      event: 'notification',
      userId: saved.userId ?? undefined,
      data: saved,
    });

    // Optional email (only for a targeted user).
    if (dto.email && saved.userId) {
      const user = await this.users.findOne({ where: { id: saved.userId } });
      if (user?.email) {
        await this.email.send({
          to: user.email,
          subject: saved.title,
          text: saved.body ?? saved.title,
        });
      }
    }
    return saved;
  }

  /** A user's own notifications plus broadcasts, newest first. */
  list(userId: string, limit = 50): Promise<Notification[]> {
    return this.repo.find({
      where: [{ userId }, { userId: IsNull() }],
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  /** Unread count of personal notifications (broadcasts aren't per-user read). */
  unreadCount(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notif = await this.repo.findOne({ where: { id } });
    if (!notif) return;
    if (notif.userId && notif.userId !== userId) {
      throw new ForbiddenException('Not your notification');
    }
    if (!notif.readAt) {
      await this.repo.update(id, { readAt: new Date() });
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.update({ userId, readAt: IsNull() }, { readAt: new Date() });
  }
}
