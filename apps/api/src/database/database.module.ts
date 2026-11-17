import { Global, Inject, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV, type Env } from '../config/env';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;
/** A transaction handle from db.transaction(async (tx) => ...). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything you can run queries on: the db or a transaction. */
export type DbOrTx = Database | Tx;

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

/** Inject the Drizzle database: `constructor(@InjectDb() private readonly db: Database) {}` */
export const InjectDb = () => Inject(DB);

export function createDatabase(url: string, max = 10) {
  const pool = new Pool({ connectionString: url, max });
  const db = drizzle({ client: pool, schema });
  return { pool, db };
}

@Injectable()
class PoolCloser implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) => new Pool({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle({ client: pool, schema }),
    },
    PoolCloser,
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule {}
