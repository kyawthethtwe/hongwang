import { z } from 'zod';

const bool = z.preprocess((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' || v === '' ? false : v), z.boolean());
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_TEST: optional,
  DATABASE_POOL_MAX: z.coerce.number().int().default(10),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().default(30),
  COOKIE_SECURE: bool.default(false),
  COOKIE_DOMAIN: optional,

  STRIPE_SECRET_KEY: optional,
  STRIPE_PUBLISHABLE_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,

  SMTP_URL: z.string().default('smtp://localhost:1025'),
  MAIL_FROM: z.string().default('Hongwang <no-reply@hongwang.local>'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: optional,
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  S3_PUBLIC_URL: optional,

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  SMS_DRIVER: z.enum(['log']).default('log'),
  AUTO_APPROVE_LISTINGS: bool.default(true),
});

export type Env = z.infer<typeof envSchema>;

/** Inject the parsed environment: `constructor(@Inject(ENV) private readonly env: Env) {}` */
export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  return parsed.data;
}
