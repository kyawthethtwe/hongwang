import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SmsService } from './sms.service';
import { TokenService } from './token.service';

/**
 * Owner: Auth & Accounts module.
 * Register, login, refresh/logout (httpOnly cookies), phone OTP, password reset, email verification, Google sign-in.
 * Sessions are persisted by SessionsService (UsersModule); cookie helpers live in ./cookies.ts.
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, SmsService, GoogleOAuthService],
  exports: [TokenService, SmsService],
})
export class AuthModule {}
