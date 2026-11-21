import type { JwtPayload, UserRole } from '@hongwang/shared';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENV, type Env } from '../../config/env';

/** Signs the access JWT that JwtAuthGuard (src/common/auth.ts) verifies. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  signAccess(user: { id: string; role: UserRole }, sessionId: string): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role, sid: sessionId };
    return this.jwt.signAsync(payload, { secret: this.env.JWT_ACCESS_SECRET, expiresIn: this.env.ACCESS_TOKEN_TTL_SEC });
  }
}
