// @ts-check
import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { typeScript } from '../../eslint.base.mjs';

/** Next.js presets (React, hooks, accessibility, Core Web Vitals) on top of the shared type-aware rules. */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...typeScript(import.meta.dirname),
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // onClick={async () => ...} and handleSubmit(async ...) are fine: React ignores the returned promise.
      // (typescript-eslint's recommended setting for React.)
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // These two serve the React Compiler, which this app doesn't use (no `reactCompiler` in next.config).
      // set-state-in-effect flags ~10 effects (timers, checkout polling, the reserve card) that would need
      // restructuring; revisit once Playwright covers those flows (implementation plan, M0 5.4).
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
]);
