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
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
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
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.env.JWT_ACCESS_SECRET });
        req.user = { id: payload.sub, role: payload.role, sessionId: payload.sid };
      } catch {
        if (!isPublic && !isOptional) throw new UnauthorizedException('Your session has expired');
      }
    }
    if (isPublic || isOptional) return true;
    if (!req.user) throw new UnauthorizedException('Please sign in');
    return true;
  }
}

export function extractAccessToken(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIES.access];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
