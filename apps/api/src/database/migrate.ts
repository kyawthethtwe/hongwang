/* Applies SQL migrations in src/database/migrations. Usage: pnpm db:migrate [databaseUrl] */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './database.module';

export async function runMigrations(url: string) {
  const { pool, db } = createDatabase(url, 1);
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.argv[2] ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
