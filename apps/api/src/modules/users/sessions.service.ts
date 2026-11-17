import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne } from 'drizzle-orm';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { sessions } from '../../database/schema';
import type { RequestMeta } from '../auth/request-meta';
import {
  classifyRefreshFailure,
  formatRefreshCookie,
  parseRefreshCookie,
  randomToken,
  sha256,
  type RefreshRejection,
} from '../auth/tokens';
import type { SessionRow } from './users.mappers';

export interface IssuedSession {
  sessionId: string;
  /** Cookie value `<sessionId>.<token>` */
  refreshCookie: string;
  expiresAt: Date;
}

export type RotateResult =
  | { ok: true; userId: string; sessionId: string; refreshCookie: string }
  | { ok: false; reason: RefreshRejection | 'missing' };

/**
 * Refresh-token sessions ("Where you're signed in"). The refresh token is 32 random bytes, stored
 * as sha256 in sessions.refresh_token_hash and rotated on every refresh. A valid session id with a
 * stale token (outside a short race window) is treated as token theft and revokes that session.
 * Owner: Auth & Accounts module. Used by AuthService and UsersService.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private expiry(from = new Date()): Date {
    return new Date(from.getTime() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }

  async create(userId: string, meta: RequestMeta, db: DbOrTx = this.db): Promise<IssuedSession> {
    const token = randomToken();
    const [row] = await db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: sha256(token),
        userAgent: meta.userAgent,
        ip: meta.ip,
        expiresAt: this.expiry(),
      })
      .returning({ id: sessions.id, expiresAt: sessions.expiresAt });
    return { sessionId: row!.id, refreshCookie: formatRefreshCookie(row!.id, token), expiresAt: row!.expiresAt };
  }

  /** Swaps the refresh token for a new one (atomic compare-and-set on the stored hash). */
  async rotate(cookieValue: string | undefined, meta: RequestMeta): Promise<RotateResult> {
    if (!cookieValue) return { ok: false, reason: 'missing' };
    const parsed = parseRefreshCookie(cookieValue);
    if (!parsed) return { ok: false, reason: 'invalid' };

    const now = new Date();
    const token = randomToken();
    const [updated] = await this.db
      .update(sessions)
      .set({
        refreshTokenHash: sha256(token),
        lastUsedAt: now,
        expiresAt: this.expiry(now),
        userAgent: meta.userAgent,
        ip: meta.ip,
      })
      .where(
        and(
          eq(sessions.id, parsed.sessionId),
          eq(sessions.refreshTokenHash, sha256(parsed.token)),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
        ),
      )
      .returning({ id: sessions.id, userId: sessions.userId });
    if (updated) {
      return { ok: true, userId: updated.userId, sessionId: updated.id, refreshCookie: formatRefreshCookie(updated.id, token) };
    }

    const [row] = await this.db
      .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt, lastUsedAt: sessions.lastUsedAt })
      .from(sessions)
      .where(eq(sessions.id, parsed.sessionId))
      .limit(1);
    const reason = classifyRefreshFailure(row, now);
    if (reason === 'reuse') {
      this.logger.warn(`Refresh token reuse on session ${parsed.sessionId}; revoking it`);
      await this.db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, parsed.sessionId));
    }
    return { ok: false, reason };
  }

  /** Revokes the session named by a refresh cookie, if the token matches (logout without a valid JWT). */
  async revokeByCookie(cookieValue: string | undefined): Promise<void> {
    const parsed = parseRefreshCookie(cookieValue);
    if (!parsed) return;
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, parsed.sessionId), eq(sessions.refreshTokenHash, sha256(parsed.token)), isNull(sessions.revokedAt)));
  }

  /** Active sessions, most recently used first. */
  async listActive(userId: string): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt));
  }

  /** True when the session was active and is now revoked. */
  async revoke(userId: string, sessionId: string, db: DbOrTx = this.db): Promise<boolean> {
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  /** Revokes every active session of the user, optionally keeping one (the caller's). */
  async revokeAll(userId: string, opts: { except?: string } = {}, db: DbOrTx = this.db): Promise<number> {
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), opts.except ? ne(sessions.id, opts.except) : undefined),
      )
      .returning({ id: sessions.id });
    return rows.length;
  }
}
