import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommsController } from './comms.controller';
import { NotificationsService } from './notifications.service';
import { MessagesService } from './messages.service';
import { EmailService } from './email.service';
import { DirectMessage, Notification, User } from '../../database/entities';

/**
 * Notifications & communication (Module 12): in-app notifications, internal
 * messaging, and SMTP email. NotificationsService/EmailService are exported so
 * other modules (e.g. SLA monitoring) can push alerts.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, DirectMessage, User])],
  controllers: [CommsController],
  providers: [NotificationsService, MessagesService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class CommsModule {}
