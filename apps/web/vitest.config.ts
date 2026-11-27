import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the web app's pure UI logic (*.test.ts next to the code). Components and flows are
 * covered by the Playwright golden paths in e2e/ (implementation plan, M0 5.4).
 */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
