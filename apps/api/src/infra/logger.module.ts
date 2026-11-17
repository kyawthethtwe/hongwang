import { Module } from '@nestjs/common';
import { LoggerModule as PinoModule } from 'nestjs-pino';
import { ENV, type Env } from '../config/env';

@Module({
  imports: [
    PinoModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
          redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
          autoLogging: { ignore: (req) => req.url === '/api/health' },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
