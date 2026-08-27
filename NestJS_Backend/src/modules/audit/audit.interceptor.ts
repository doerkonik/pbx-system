import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const ACTION_BY_METHOD: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};
/** Never persist these body keys. */
const REDACT = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'secret',
  'pin',
  'adminPin',
  'token',
  'refreshToken',
  'twoFactorSecret',
]);
/** Paths we never audit (auth handles credentials; avoid logging them). */
const SKIP_PREFIXES = ['/auth/login', '/auth/refresh'];

/**
 * Global interceptor that records every successful mutating request by an
 * authenticated user to the audit trail (Module 10). Best-effort: a failed
 * audit write never affects the response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const user = req.user as AuthenticatedUser | undefined;
    const path: string = req.originalUrl?.split('?')[0] ?? req.url ?? '';

    const auditable =
      MUTATING.has(method) &&
      !!user &&
      !SKIP_PREFIXES.some((p) => path.includes(p));

    if (!auditable) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        const { resource, resourceId } = this.parsePath(path);
        void this.audit.record({
          userId: user!.sub,
          username: user!.username,
          role: user!.role,
          method,
          path: path.slice(0, 200),
          action: ACTION_BY_METHOD[method] ?? 'action',
          resource,
          resourceId,
          statusCode: res?.statusCode ?? null,
          ip: this.clientIp(req),
          meta: this.buildMeta(req),
        });
      }),
    );
  }

  /** Resource = first non-"api" path segment; resourceId = a following UUID. */
  private parsePath(path: string): {
    resource: string | null;
    resourceId: string | null;
  } {
    const segs = path.split('/').filter((s) => s && s !== 'api');
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resource = segs[0] ?? null;
    const resourceId = segs.find((s) => uuid.test(s)) ?? null;
    return { resource, resourceId: resourceId ?? null };
  }

  private clientIp(req: any): string | null {
    const fwd = req.headers?.['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    return (ip || req.ip || req.socket?.remoteAddress || null)?.slice(0, 64) ?? null;
  }

  private buildMeta(req: any): Record<string, unknown> | null {
    const meta: Record<string, unknown> = {};
    if (req.params && Object.keys(req.params).length) meta.params = req.params;
    if (req.body && typeof req.body === 'object') {
      meta.body = this.redact(req.body);
    }
    return Object.keys(meta).length ? meta : null;
  }

  private redact(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = REDACT.has(k)
        ? '[redacted]'
        : v && typeof v === 'object' && !Array.isArray(v)
          ? this.redact(v as Record<string, unknown>)
          : v;
    }
    return out;
  }
}
