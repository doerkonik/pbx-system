import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MessagesService } from './messages.service';
import { EmailService } from './email.service';
import {
  CreateNotificationDto,
  SendMessageDto,
  TestEmailDto,
} from './dto/comms.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';

@Controller()
export class CommsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly messages: MessagesService,
    private readonly email: EmailService,
  ) {}

  /* ----------------------------- Notifications ------------------------- */

  @Get('notifications')
  listNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.sub);
  }

  @Get('notifications/unread-count')
  async unreadNotifications(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.sub) };
  }

  @Post('notifications/:id/read')
  @HttpCode(204)
  async readNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.notifications.markRead(id, user.sub);
  }

  @Post('notifications/read-all')
  @HttpCode(204)
  async readAllNotifications(@CurrentUser() user: AuthenticatedUser) {
    await this.notifications.markAllRead(user.sub);
  }

  /** Send a notification to a user or broadcast (staff only). */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('notifications')
  createNotification(@Body() dto: CreateNotificationDto) {
    return this.notifications.notify(dto);
  }

  /** Send a test email to verify SMTP config (admin). */
  @Roles(UserRole.ADMIN)
  @Post('notifications/test-email')
  @HttpCode(200)
  async testEmail(@Body() dto: TestEmailDto) {
    const sent = await this.email.send({
      to: dto.to,
      subject: 'PBX Suite test email',
      text: 'SMTP is configured correctly.',
    });
    return { sent, smtpEnabled: this.email.enabled };
  }

  /* ------------------------------- Messages ---------------------------- */

  @Post('messages')
  @HttpCode(200)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user.sub, dto.toUserId, dto.body);
  }

  @Get('messages/unread-count')
  async unreadMessages(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.messages.unreadCount(user.sub) };
  }

  @Get('messages/conversation/:userId')
  conversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) otherUserId: string,
  ) {
    return this.messages.conversation(user.sub, otherUserId);
  }

  @Post('messages/conversation/:userId/read')
  @HttpCode(204)
  async readConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) otherUserId: string,
  ) {
    await this.messages.markConversationRead(user.sub, otherUserId);
  }
}
