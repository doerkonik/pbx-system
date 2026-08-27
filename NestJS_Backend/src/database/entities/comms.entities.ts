import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Notifications & communication (Module 12).
 *
 * `Notification` is a per-user (or broadcast) in-app alert, optionally also
 * emailed. `DirectMessage` is a 1:1 agent↔supervisor chat message. Both are
 * pushed live over the `notification.events` Redis channel → the recipient's
 * `user:<id>` WebSocket room.
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Recipient user id; NULL = broadcast to everyone. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** e.g. sla | system | message | info | warning. */
  @Column({ type: 'varchar', length: 40, default: 'info' })
  type: string;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Optional deep-link the UI can navigate to. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  link: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('direct_messages')
@Index(['toUserId', 'readAt'])
export class DirectMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  fromUserId: string;

  @Index()
  @Column({ type: 'uuid' })
  toUserId: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
