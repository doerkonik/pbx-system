import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppConfig, JwtConfig } from '../config/configuration';
import { UserRole } from '../common/enums';
import { authenticateSocket } from './ws-jwt.util';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export const ROOM_ADMIN = 'role:admin';
export const roomForAgent = (extension: string) => `agent:${extension}`;
export const roomForUser = (userId: string) => `user:${userId}`;

/**
 * Socket.io gateway. JWT-authenticated on connect. Admins join the global admin
 * room (full visibility); agents join a room scoped to their own extension so a
 * targeted emit never leaks another agent's data.
 *
 * The gateway does NOT talk to Asterisk — RedisSubscriberService feeds it
 * normalized events which it fans out to the right rooms.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const secret = this.config.get<JwtConfig>('jwt')!.accessSecret;
    const user = await authenticateSocket(client, this.jwt, secret);
    if (!user) {
      this.logger.warn(`WS rejected (no/invalid token): ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }
    (client.data as { user: AuthenticatedUser }).user = user;

    // Admins and supervisors both get the full live stream (supervisors need it
    // for real-time agent/queue monitoring). Agents are scoped to their own ext.
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      await client.join(ROOM_ADMIN);
    } else if (user.extension) {
      await client.join(roomForAgent(user.extension));
    }
    // Every socket also joins a per-user room for direct notifications/messages.
    await client.join(roomForUser(user.sub));
    this.logger.debug(`WS connected ${client.id} (${user.username}/${user.role})`);
    client.emit('connected', { user, at: new Date().toISOString() });
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnected ${client.id}`);
  }

  /** Agents may (re)subscribe to their own extension room; admins to all. */
  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { extension?: string },
  ): { ok: boolean } {
    const user = (client.data as { user: AuthenticatedUser }).user;
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return { ok: true };
    }
    // Agents can only listen to their own extension.
    if (body?.extension && body.extension !== user.extension) {
      return { ok: false };
    }
    return { ok: true };
  }

  // --- Fan-out helpers used by RedisSubscriberService ----------------------

  emitToAdmins(event: string, payload: unknown): void {
    this.server?.to(ROOM_ADMIN).emit(event, payload);
  }

  emitToAgent(extension: string, event: string, payload: unknown): void {
    this.server?.to(roomForAgent(extension)).emit(event, payload);
  }

  emitToAll(event: string, payload: unknown): void {
    this.server?.emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(roomForUser(userId)).emit(event, payload);
  }
}
