import { ERROR_CODES, type AuthProvidersDto, type AuthResponse, type GoogleAuthError, type MeDto, type PhoneSendCodeResponse } from '@hongwang/shared';
import { Body, Controller, Delete, Get, HttpCode, Inject, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser, OptionalAuth, Public, type AuthUser } from '../../common/auth';
import { AppException, notFound } from '../../common/errors';
import { ENV, type Env } from '../../config/env';
import {
  ForgotPasswordDto,
  GoogleCallbackQueryDto,
  GoogleStartQueryDto,
  LoginDto,
  PhoneSendCodeDto,
  PhoneVerifyDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import {
  clearAuthCookies,
  clearOauthStateCookie,
  OAUTH_STATE_COOKIE,
  readCookie,
  readRefreshCookie,
  setAuthCookies,
  setOauthStateCookie,
} from './cookies';
import { formatOauthState, parseOauthState } from './google';
import { GoogleOAuthService } from './google-oauth.service';
import { ReqMeta, safeNextPath, type RequestMeta } from './request-meta';
import { randomToken, safeEqual } from './tokens';

/** 10 requests per minute per IP for the endpoints people could brute-force or spam. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

/** Auth contract: packages/shared/src/schemas/auth.ts */
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private webUrl(path: string): string {
    return `${this.env.WEB_ORIGIN.replace(/\/$/, '')}${path}`;
  }

  @Public()
  @Throttle(STRICT)
  @Post('register')
  async register(@Body() body: RegisterDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const { response, tokens } = await this.auth.register(body, meta);
    setAuthCookies(res, this.env, tokens);
    return response;
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const { response, tokens } = await this.auth.login(body, meta);
    setAuthCookies(res, this.env, tokens);
    return response;
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const outcome = await this.auth.refresh(readRefreshCookie(req), meta);
    if (!outcome.ok) {
      if (outcome.clearCookies) clearAuthCookies(res, this.env);
      throw new AppException(401, ERROR_CODES.unauthorized, 'Your session has ended. Please sign in again.');
    }
    setAuthCookies(res, this.env, outcome.result.tokens);
    return outcome.result.response;
  }

  @OptionalAuth()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(user, readRefreshCookie(req));
    clearAuthCookies(res, this.env);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.auth.me(user);
  }

  @Public()
  @Throttle(STRICT)
  @Post('phone/send-code')
  @HttpCode(200)
  sendPhoneCode(@Body() body: PhoneSendCodeDto): Promise<PhoneSendCodeResponse> {
    return this.auth.sendPhoneCode(body.phone);
  }

  @Public()
  @Throttle(STRICT)
  @Post('phone/verify')
  @HttpCode(200)
  async verifyPhone(@Body() body: PhoneVerifyDto, @ReqMeta() meta: RequestMeta, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    const { response, tokens } = await this.auth.verifyPhone(body, meta);
    setAuthCookies(res, this.env, tokens);
    return response;
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/forgot')
  @HttpCode(204)
  forgotPassword(@Body() body: ForgotPasswordDto): void {
    this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body() body: ResetPasswordDto, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.resetPassword(body);
    // Every session was revoked; this browser signs in again with the new password.
    clearAuthCookies(res, this.env);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('email/verify')
  @HttpCode(204)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<void> {
    await this.auth.verifyEmail(body.token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/resend')
  @HttpCode(204)
  async resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.resendVerification(user);
  }

  @Public()
  @Get('providers')
  providers(): AuthProvidersDto {
    return this.auth.providers();
  }

  // ---- Google ----

  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google')
  googleStart(@Query() query: GoogleStartQueryDto, @CurrentUser() user: AuthUser | undefined, @Res() res: Response): void {
    if (!this.google.enabled) throw notFound();
    const state = randomToken(24);
    const connect = !!query.connect && !!user;
    setOauthStateCookie(res, this.env, formatOauthState({ state, connect, next: safeNextPath(query.next) }));
    res.redirect(302, this.google.authorizeUrl(state));
  }

  @OptionalAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('google/callback')
  async googleCallback(
    @Query() query: GoogleCallbackQueryDto,
    @CurrentUser() user: AuthUser | undefined,
    @ReqMeta() meta: RequestMeta,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.google.enabled) throw notFound();
    const stored = parseOauthState(readCookie(req, OAUTH_STATE_COOKIE));
    clearOauthStateCookie(res, this.env);

    const fail = (error: GoogleAuthError) => {
      const target = stored?.connect
        ? `/account?section=security&error=${error}`
        : `/login?error=${error}${stored && stored.next !== '/' ? `&next=${encodeURIComponent(stored.next)}` : ''}`;
      res.redirect(302, this.webUrl(target));
    };

    if (!stored || !query.state || !safeEqual(stored.state, query.state)) return fail('google_state');
    if (query.error || !query.code) return fail('google');
    // Connecting needs the caller; if their access token lapsed meanwhile, don't sign in as someone else.
    if (stored.connect && !user) return fail('google_state');

    let outcome;
    try {
      const profile = await this.google.fetchProfile(query.code);
      outcome = await this.auth.googleSignIn(profile, meta, stored.connect ? user : undefined);
      if (!outcome.ok) return fail(outcome.error);
    } catch (err) {
      this.logger.warn(`Google sign-in failed: ${String(err)}`);
      return fail('google');
    }
    if (outcome.result) setAuthCookies(res, this.env, outcome.result.tokens);
    res.redirect(302, this.webUrl(stored.next));
  }

  @Delete('google')
  @HttpCode(204)
  async googleDisconnect(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.googleDisconnect(user);
  }
}
