import { existsSync } from 'node:fs';
import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv } from './env';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => {
        if (existsSync('.env')) process.loadEnvFile('.env');
        return loadEnv();
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
