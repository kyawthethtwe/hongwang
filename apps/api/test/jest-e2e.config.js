/**
 * DB-backed tests (whiteboard MVP test: "50 parallel bookings, exactly 1 wins").
 *   pnpm --filter @hongwang/api test:e2e
 * Needs DATABASE_URL_TEST pointing at Postgres with PostGIS + btree_gist (docker compose's postgis
 * image works). The global setup creates the database if missing and runs the migrations; when the
 * variable is unset or the server is unreachable, the suites are skipped with a console message.
 */
module.exports = {
  rootDir: '..',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.(t|j)s$': '@swc/jest' },
  testEnvironment: 'node',
  // Crawl files directly: a broken watchman install made Jest exit 0 without running any tests.
  watchman: false,
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  testTimeout: 120_000,
};
