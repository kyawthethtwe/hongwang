import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { ENV, type Env } from './config/env';
import { LOCAL_UPLOAD_DIR } from './infra/storage/storage.service';

async function bootstrap() {
  // rawBody: the Stripe webhook verifies the signature over the exact bytes (req.rawBody).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true, bufferLogs: true });
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  app.useStaticAssets(LOCAL_UPLOAD_DIR, { prefix: '/uploads/', maxAge: '7d' });
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Hongwang API').build());
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(doc));
  }

  await app.listen(env.PORT);
}

void bootstrap();
