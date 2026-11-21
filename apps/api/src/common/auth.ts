import { AUTH_COOKIES, type JwtPayload, type UserRole } from '@hongwang/shared';
import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env';
import { SessionsService } from '../modules/users/sessions.service';

/** The caller, attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
  sessionId: string;
}

export type AuthedRequest = Request & { user?: AuthUser };

const IS_PUBLIC = 'auth:public';
const IS_OPTIONAL = 'auth:optional';

/** No sign-in needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** No sign-in needed, but `@CurrentUser()` is filled when a valid cookie is present. */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL, true);

/** `@CurrentUser() user: AuthUser` (undefined on @Public/@OptionalAuth routes without a session). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

/**
 * Global guard (registered in app.module.ts). Every route needs a valid access-token cookie
 * unless marked @Public() or @OptionalAuth(). Tokens are issued by the Auth module.
 *
 * A valid signature isn't enough: the token's session must still be active
 * (SessionsService.findActive), so signing out elsewhere, a password change, account deletion or
 * suspension ends the session on its next request instead of when the 15-minute token expires.
 * The role comes from the database too, so a role change applies at once.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const targets = [ctx.getHandler(), ctx.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);
    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL, targets);
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();

    const token = extractAccessToken(req);
    if (token) {
      const payload = await this.verify(token);
      const active = payload ? await this.sessions.findActive(payload.sid, payload.sub) : null;
      if (payload && active) req.user = { id: payload.sub, role: active.role, sessionId: payload.sid };
      else if (!isPublic && !isOptional) {
        // The web client refreshes on this 401; for a revoked session that fails too and signs out.
        throw new UnauthorizedException(payload ? 'Your session has ended. Please sign in again.' : 'Your session has expired');
      }
    }
    if (isPublic || isOptional) return true;
    if (!req.user) throw new UnauthorizedException('Please sign in');
    return true;
  }

  /** The token's payload, or null when it's expired, tampered with or malformed. */
  private async verify(token: string): Promise<JwtPayload | null> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
    } catch {
      return null;
    }
  }
}

export function extractAccessToken(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIES.access];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
