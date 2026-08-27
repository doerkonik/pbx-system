import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Extract + verify the access token from a Socket.io handshake.
 * Accepts it from `auth.token`, the Authorization header, or `?token=`.
 * Returns the authenticated user or null (caller disconnects on null).
 */
export async function authenticateSocket(
  client: Socket,
  jwt: JwtService,
  accessSecret: string,
): Promise<AuthenticatedUser | null> {
  const raw =
    (client.handshake.auth?.token as string) ||
    (client.handshake.headers?.authorization as string) ||
    (client.handshake.query?.token as string) ||
    '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  if (!token) return null;
  try {
    const payload = await jwt.verifyAsync(token, { secret: accessSecret });
    if (payload.type !== 'access') return null;
    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      extension: payload.extension ?? null,
    };
  } catch {
    return null;
  }
}
