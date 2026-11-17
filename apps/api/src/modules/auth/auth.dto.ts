import {
  forgotPasswordInputSchema,
  loginInputSchema,
  phoneSendCodeInputSchema,
  phoneVerifyInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  verifyEmailInputSchema,
} from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class RegisterDto extends createZodDto(registerInputSchema) {}
export class LoginDto extends createZodDto(loginInputSchema) {}
export class PhoneSendCodeDto extends createZodDto(phoneSendCodeInputSchema) {}
export class PhoneVerifyDto extends createZodDto(phoneVerifyInputSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordInputSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordInputSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailInputSchema) {}

/** GET /auth/google?next=/trips&connect=1 */
export class GoogleStartQueryDto extends createZodDto(
  z.object({
    next: z.string().max(512).optional(),
    connect: z.enum(['1', 'true']).optional(),
  }),
) {}

/** GET /auth/google/callback?code=…&state=… (or ?error=access_denied) */
export class GoogleCallbackQueryDto extends createZodDto(
  z.object({
    code: z.string().max(2048).optional(),
    state: z.string().max(256).optional(),
    error: z.string().max(256).optional(),
  }),
) {}
