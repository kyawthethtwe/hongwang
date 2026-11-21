import { prepareTestDatabase, SKIP_ENV } from './database';

/**
 * Jest globalSetup for test/jest-e2e.config.js. Locally, a missing or unreachable database skips the
 * suites with a warning. In CI (`CI` is set, as GitHub Actions does) it fails instead, so a broken
 * database service can never pass as a green run.
 */
export default async function globalSetup() {
  const reason = await prepareTestDatabase();
  if (!reason) return;
  if (process.env.CI) throw new Error(`[e2e] Database tests can't run in CI: ${reason}`);
  process.env[SKIP_ENV] = reason;
  // eslint-disable-next-line no-console
  console.warn(`\n[e2e] Skipping database tests: ${reason}\n`);
}
