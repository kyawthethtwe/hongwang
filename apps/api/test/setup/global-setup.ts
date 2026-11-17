import { prepareTestDatabase, SKIP_ENV } from './database';

/** Jest globalSetup for test/jest-e2e.config.js. */
export default async function globalSetup() {
  const reason = await prepareTestDatabase();
  if (reason) {
    process.env[SKIP_ENV] = reason;
    // eslint-disable-next-line no-console
    console.warn(`\n[e2e] Skipping database tests: ${reason}\n`);
  }
}
