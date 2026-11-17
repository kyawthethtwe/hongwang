import {
  ERROR_CODES,
  type AuthProvidersDto,
  type AuthResponse,
  type EmailJob,
  type EmailTemplate,
  type GoogleAuthError,
  type MeDto,
  type PhoneSendCodeResponse,
} from '@hongwang/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, conflict, forbidden, isUniqueViolation } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database } from '../../database/database.module';
import { users, verificationTokens } from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SessionsService } from '../users/sessions.service';
import type { UserRow } from '../users/users.mappers';
import { UsersService } from '../users/users.service';
import type { LoginDto, PhoneVerifyDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import type { IssuedTokens } from './cookies';
import { googleNames, resolveGoogleLink, type GoogleProfile } from './google';
import { GoogleOAuthService } from './google-oauth.service';
import { checkOtp, generateOtp, hashOtp, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SEC, OTP_TTL_SEC, otpErrorMessage, resendWaitSec } from './otp';
import { hashPassword, verifyPassword } from './passwords';
import type { RequestMeta } from './request-meta';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';
import { randomToken, sha256 } from './tokens';

export const EMAIL_VERIFY_TTL_MS = 24 * 3_600_000;
export const PASSWORD_RESET_TTL_MS = 30 * 60_000;
export const EMAIL_RESEND_COOLDOWN_MS = 60_000;

/** What a sign-in returns: the body for the client and the cookies for the controller to set. */
export interface AuthResult {
  response: AuthResponse;
  tokens: IssuedTokens;
}

export type RefreshOutcome = { ok: true; result: AuthResult } | { ok: false; clearCookies: boolean };

/** `result` is null when a signed-in user connected Google (no new session). */
export type GoogleSignInOutcome = { ok: true; result: AuthResult | null } | { ok: false; error: GoogleAuthError };

const invalidCode = (message: string, field?: string) =>
  new AppException(400, ERROR_CODES.invalidCode, message, field ? [{ path: [field], message }] : undefined);

/**
 * Owner: Auth & Accounts module. Registration, password and phone sign-in, refresh-token rotation,
 * email verification, password reset and Google sign-in. Cookies are set by AuthController.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly tokens: TokenService,
    private readonly sms: SmsService,
    private readonly google: GoogleOAuthService,
    private readonly notifications: NotificationsService,
  ) {}

  private webUrl(path: string): string {
    return `${this.env.WEB_ORIGIN.replace(/\/$/, '')}${path}`;
  }

  /** Emails are queued; a queue outage must not fail the sign-up or reset itself. */
  private async queueEmail<T extends EmailTemplate>(job: EmailJob<T>): Promise<void> {
    try {
      await this.notifications.sendEmail(job);
    } catch (err) {
      this.logger.error(`Could not queue ${job.template} email: ${String(err)}`);
    }
  }

  /** Creates a session and the cookie values for `user`. */
  private async signIn(user: UserRow, meta: RequestMeta, isNew?: boolean): Promise<AuthResult> {
    if (user.deletedAt) throw new AppException(401, ERROR_CODES.unauthorized, 'Please sign in');
    if (user.suspendedAt) throw forbidden('This account is suspended. Contact support if you think this is a mistake.');
    const session = await this.sessions.create(user.id, meta);
    const accessToken = await this.tokens.signAccess(user, session.sessionId);
    const response: AuthResponse = { user: await this.users.toMe(user) };
    if (isNew !== undefined) response.isNew = isNew;
    return { response, tokens: { accessToken, refreshCookie: session.refreshCookie } };
  }

  providers(): AuthProvidersDto {
    return { google: this.google.enabled };
  }

  me(caller: AuthUser): Promise<MeDto> {
    return this.users.getMe(caller.id);
  }

  // ---- email + password ----

  async register(input: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    const emailTaken = () =>
      new AppException(409, ERROR_CODES.emailTaken, 'An account with this email already exists', [
        { path: ['email'], message: 'An account with this email already exists. Try signing in instead.' },
      ]);
    if (await this.users.findByEmail(input.email)) throw emailTaken();

    const passwordHash = await hashPassword(input.password);
    let user: UserRow;
    try {
      [user] = (await this.db
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          passwordChangedAt: new Date(),
          firstName: input.firstName,
          lastName: input.lastName,
          lineOptIn: input.lineOptIn ?? false,
        })
        .returning()) as [UserRow];
    } catch (err) {
      if (isUniqueViolation(err)) throw emailTaken();
      throw err;
    }

    await this.sendVerifyEmail(user);
    return this.signIn(user, meta, true);
  }

  async login(input: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    const ok = await verifyPassword(user?.passwordHash, input.password);
    if (!user || !ok) {
      throw new AppException(401, ERROR_CODES.invalidCredentials, 'That email and password don’t match. Try again or reset your password.');
    }
    return this.signIn(user, meta);
  }

  async refresh(cookieValue: string | undefined, meta: RequestMeta): Promise<RefreshOutcome> {
    const rotated = await this.sessions.rotate(cookieValue, meta);
    if (!rotated.ok) {
      // A tab racing another tab's refresh must not wipe the cookies the winner just set.
      return { ok: false, clearCookies: rotated.reason !== 'stale' };
    }
    const user = await this.users.findById(rotated.userId);
    if (!user || user.deletedAt || user.suspendedAt) {
      await this.sessions.revokeAll(rotated.userId);
      return { ok: false, clearCookies: true };
    }
    const accessToken = await this.tokens.signAccess(user, rotated.sessionId);
    return {
      ok: true,
      result: { response: { user: await this.users.toMe(user) }, tokens: { accessToken, refreshCookie: rotated.refreshCookie } },
    };
  }

  /** Revokes the caller's session (from the JWT, or from the refresh cookie when the JWT expired). */
  async logout(caller: AuthUser | undefined, refreshCookie: string | undefined): Promise<void> {
    if (caller) await this.sessions.revoke(caller.id, caller.sessionId);
    await this.sessions.revokeByCookie(refreshCookie);
  }

  // ---- phone ----

  async sendPhoneCode(phone: string): Promise<PhoneSendCodeResponse> {
    const now = new Date();
    const [last] = await this.db
      .select({ createdAt: verificationTokens.createdAt })
      .from(verificationTokens)
      .where(and(eq(verificationTokens.kind, 'phone_otp'), eq(verificationTokens.target, phone)))
      .orderBy(desc(verificationTokens.createdAt))
      .limit(1);
    const wait = resendWaitSec(last?.createdAt, now);
    if (wait > 0) {
      throw new AppException(429, ERROR_CODES.rateLimited, `You can ask for a new code in ${wait} seconds.`, { resendInSec: wait });
    }

    const code = generateOtp();
    const existing = await this.users.findByPhone(phone);
    await this.db.transaction(async (tx) => {
      // A new code replaces any earlier one.
      await tx
        .update(verificationTokens)
        .set({ consumedAt: now })
        .where(and(eq(verificationTokens.kind, 'phone_otp'), eq(verificationTokens.target, phone), isNull(verificationTokens.consumedAt)));
      await tx.insert(verificationTokens).values({
        kind: 'phone_otp',
        target: phone,
        userId: existing?.id ?? null,
        tokenHash: hashOtp(this.env.JWT_REFRESH_SECRET, phone, code),
        expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
      });
    });
    await this.sms.send(phone, `Your Hongwang code is ${code}. It expires in ${OTP_TTL_SEC / 60} minutes. Don't share it with anyone.`);
    return { expiresInSec: OTP_TTL_SEC, resendInSec: OTP_RESEND_COOLDOWN_SEC };
  }

  /** Signs in by phone, or creates the account (first and last name needed then). */
  async verifyPhone(input: PhoneVerifyDto, meta: RequestMeta): Promise<AuthResult> {
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.kind, 'phone_otp'),
          eq(verificationTokens.target, input.phone),
          isNull(verificationTokens.consumedAt),
        ),
      )
      .orderBy(desc(verificationTokens.createdAt))
      .limit(1);
    if (!row) throw invalidCode('Ask for a code first, or ask for a new one.', 'code');
    if (row.expiresAt <= now) throw invalidCode(otpErrorMessage({ status: 'expired' }), 'code');

    // Count the attempt atomically so parallel guesses can't exceed the limit.
    const [counted] = await this.db
      .update(verificationTokens)
      .set({ attempts: sql`${verificationTokens.attempts} + 1` })
      .where(
        and(eq(verificationTokens.id, row.id), lt(verificationTokens.attempts, OTP_MAX_ATTEMPTS), isNull(verificationTokens.consumedAt)),
      )
      .returning({ attempts: verificationTokens.attempts });
    if (!counted) throw invalidCode(otpErrorMessage({ status: 'locked' }), 'code');

    const check = checkOtp({ ...row, attempts: counted.attempts }, hashOtp(this.env.JWT_REFRESH_SECRET, input.phone, input.code), now);
    if (check.status !== 'ok') throw invalidCode(otpErrorMessage(check), 'code');

    const existing = await this.users.findByPhone(input.phone);
    if (!existing && (!input.firstName || !input.lastName)) {
      // Keep the code: the client asks for a name and sends the same code again.
      throw badRequest('Tell us your name to finish creating your account', [
        ...(!input.firstName ? [{ path: ['firstName'], message: 'Enter your first name' }] : []),
        ...(!input.lastName ? [{ path: ['lastName'], message: 'Enter your last name' }] : []),
      ]);
    }
    if (existing?.suspendedAt) throw forbidden('This account is suspended. Contact support if you think this is a mistake.');

    const user = await this.db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(verificationTokens)
        .set({ consumedAt: now })
        .where(and(eq(verificationTokens.id, row.id), isNull(verificationTokens.consumedAt)))
        .returning({ id: verificationTokens.id });
      if (!consumed) throw invalidCode(otpErrorMessage({ status: 'consumed' }), 'code');

      if (existing) {
        if (existing.phoneVerifiedAt) return existing;
        const [u] = await tx.update(users).set({ phoneVerifiedAt: now }).where(eq(users.id, existing.id)).returning();
        return u!;
      }
      const [u] = await tx
        .insert(users)
        .values({ phone: input.phone, phoneVerifiedAt: now, firstName: input.firstName!, lastName: input.lastName! })
        .returning();
      return u!;
    });
    return this.signIn(user, meta, !existing);
  }

  // ---- password reset ----

  /** Always resolves (no account enumeration); the work runs in the background so timing is equal too. */
  forgotPassword(email: string): void {
    void this.sendPasswordReset(email).catch((err: unknown) => this.logger.error(`Password reset failed: ${String(err)}`));
  }

  private async sendPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.suspendedAt || !user.email) return;
    const token = randomToken();
    await this.db.transaction(async (tx) => {
      await tx
        .delete(verificationTokens)
        .where(
          and(eq(verificationTokens.userId, user.id), eq(verificationTokens.kind, 'password_reset'), isNull(verificationTokens.consumedAt)),
        );
      await tx.insert(verificationTokens).values({
        userId: user.id,
        kind: 'password_reset',
        target: user.email!,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });
    });
    await this.queueEmail({
      template: 'password-reset',
      to: user.email,
      userId: user.id,
      data: { firstName: user.firstName, resetUrl: this.webUrl(`/reset-password?token=${encodeURIComponent(token)}`) },
    });
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const invalid = () => invalidCode('This reset link has expired or was already used. Ask for a new one.');
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.kind, 'password_reset'), eq(verificationTokens.tokenHash, sha256(input.token))))
      .limit(1);
    if (!row?.userId || row.consumedAt || row.expiresAt <= now) throw invalid();
    const user = await this.users.findById(row.userId);
    if (!user || user.deletedAt) throw invalid();

    const passwordHash = await hashPassword(input.password);
    await this.db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(verificationTokens)
        .set({ consumedAt: now })
        .where(and(eq(verificationTokens.id, row.id), isNull(verificationTokens.consumedAt)))
        .returning({ id: verificationTokens.id });
      if (!consumed) throw invalid();
      // The link arrived by email, so it also proves the address.
      const proves = !user.emailVerifiedAt && !!user.email && user.email.toLowerCase() === row.target.toLowerCase();
      await tx
        .update(users)
        .set({ passwordHash, passwordChangedAt: now, ...(proves ? { emailVerifiedAt: now } : {}) })
        .where(eq(users.id, user.id));
      await this.sessions.revokeAll(user.id, {}, tx);
    });
  }

  // ---- email verification ----

  private async sendVerifyEmail(user: UserRow): Promise<void> {
    if (!user.email) return;
    const token = randomToken();
    await this.db.transaction(async (tx) => {
      await tx
        .delete(verificationTokens)
        .where(
          and(eq(verificationTokens.userId, user.id), eq(verificationTokens.kind, 'email_verify'), isNull(verificationTokens.consumedAt)),
        );
      await tx.insert(verificationTokens).values({
        userId: user.id,
        kind: 'email_verify',
        target: user.email!,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      });
    });
    await this.queueEmail({
      template: 'verify-email',
      to: user.email,
      userId: user.id,
      data: { firstName: user.firstName, verifyUrl: this.webUrl(`/verify-email?token=${encodeURIComponent(token)}`) },
    });
  }

  /** Idempotent: a link that was already used for this (still verified) address succeeds again. */
  async verifyEmail(token: string): Promise<void> {
    const invalid = () => invalidCode('This link has expired or isn’t valid. Sign in and ask for a new one from your account.');
    const now = new Date();
    const [row] = await this.db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.kind, 'email_verify'), eq(verificationTokens.tokenHash, sha256(token))))
      .limit(1);
    if (!row?.userId) throw invalid();
    const user = await this.users.findById(row.userId);
    if (!user || user.deletedAt || !user.email || user.email.toLowerCase() !== row.target.toLowerCase()) throw invalid();
    if (row.consumedAt) {
      if (user.emailVerifiedAt) return;
      throw invalid();
    }
    if (row.expiresAt <= now) throw invalid();

    const firstTime = !user.emailVerifiedAt;
    await this.db.transaction(async (tx) => {
      await tx.update(verificationTokens).set({ consumedAt: now }).where(eq(verificationTokens.id, row.id));
      if (firstTime) await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, user.id));
    });
    if (firstTime) {
      await this.queueEmail({
        template: 'welcome',
        to: user.email,
        userId: user.id,
        data: { firstName: user.firstName, exploreUrl: this.webUrl('/') },
      });
    }
  }

  async resendVerification(caller: AuthUser): Promise<void> {
    const user = await this.users.findById(caller.id);
    if (!user || user.deletedAt || !user.email || user.emailVerifiedAt) return;
    const [last] = await this.db
      .select({ createdAt: verificationTokens.createdAt })
      .from(verificationTokens)
      .where(and(eq(verificationTokens.userId, user.id), eq(verificationTokens.kind, 'email_verify')))
      .orderBy(desc(verificationTokens.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < EMAIL_RESEND_COOLDOWN_MS) {
      throw new AppException(429, ERROR_CODES.rateLimited, 'We just sent a link. Check your inbox, or try again in a minute.');
    }
    await this.sendVerifyEmail(user);
  }

  // ---- Google ----

  /**
   * Signs in (or links, or creates) from a Google profile. `connectFor` is the signed-in caller when
   * they're connecting Google from /account. Returns null for `connect` without a new session.
   */
  async googleSignIn(
    profile: GoogleProfile,
    meta: RequestMeta,
    connectFor?: AuthUser,
  ): Promise<GoogleSignInOutcome> {
    const byGoogleId = await this.users.findByGoogleId(profile.sub);
    const byEmail = profile.email ? await this.users.findByEmail(profile.email) : null;
    const decision = resolveGoogleLink(profile, byGoogleId, byEmail, connectFor?.id);
    const now = new Date();

    switch (decision.action) {
      case 'error':
        return { ok: false, error: decision.error };
      case 'signin': {
        if (connectFor) return { ok: true, result: null };
        const user = byGoogleId!;
        if (user.suspendedAt) return { ok: false, error: 'suspended' };
        return { ok: true, result: await this.signIn(user, meta, false) };
      }
      case 'link': {
        const target = await this.users.findById(decision.userId);
        if (!target || target.deletedAt) return { ok: false, error: 'google' };
        if (target.suspendedAt) return { ok: false, error: 'suspended' };
        const verifies =
          !target.emailVerifiedAt && profile.emailVerified && !!target.email && target.email.toLowerCase() === profile.email;
        const [linked] = await this.db
          .update(users)
          .set({
            googleId: profile.sub,
            ...(verifies ? { emailVerifiedAt: now } : {}),
            ...(!target.avatarUrl && profile.picture ? { avatarUrl: profile.picture } : {}),
          })
          .where(eq(users.id, target.id))
          .returning();
        if (connectFor) return { ok: true, result: null };
        return { ok: true, result: await this.signIn(linked!, meta, false) };
      }
      case 'create': {
        let created: UserRow;
        try {
          [created] = (await this.db
            .insert(users)
            .values({
              ...googleNames(profile),
              email: profile.email!,
              emailVerifiedAt: profile.emailVerified ? now : null,
              googleId: profile.sub,
              avatarUrl: profile.picture,
            })
            .returning()) as [UserRow];
        } catch (err) {
          if (isUniqueViolation(err)) return { ok: false, error: 'google' };
          throw err;
        }
        if (created.email && created.emailVerifiedAt) {
          await this.queueEmail({
            template: 'welcome',
            to: created.email,
            userId: created.id,
            data: { firstName: created.firstName, exploreUrl: this.webUrl('/') },
          });
        }
        return { ok: true, result: await this.signIn(created, meta, true) };
      }
    }
  }

  /** Unlinks Google, unless it's the only way left to sign in. */
  async googleDisconnect(caller: AuthUser): Promise<void> {
    const user = await this.users.findById(caller.id);
    if (!user || user.deletedAt) throw new AppException(401, ERROR_CODES.unauthorized, 'Please sign in');
    if (!user.googleId) return;
    if (!user.passwordHash && !user.phone) {
      throw conflict('Set a password first, so you can still sign in after disconnecting Google.');
    }
    await this.db.update(users).set({ googleId: null }).where(eq(users.id, user.id));
  }
}
