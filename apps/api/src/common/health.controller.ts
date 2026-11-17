import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { InjectDb, type Database } from '../database/database.module';
import { Public } from './auth';

@Controller('health')
export class HealthController {
  constructor(@InjectDb() private readonly db: Database) {}

  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { ok: true };
  }
}
