// @ts-check
import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint rules shared by every package (ESLint 9 flat config). Each package's eslint.config.mjs
 * spreads `typeScript(import.meta.dirname)`; apps/web adds Next.js's presets on top.
 *
 * Type-aware (typescript-eslint `recommendedTypeChecked`): rules such as no-floating-promises and
 * no-misused-promises read the package's tsconfig. Formatting is left to Prettier.
 * ESLint stays on 9: eslint-plugin-react, jsx-a11y and import (via eslint-config-next) don't
 * support 10 yet.
 *
 * @param {string} tsconfigRootDir the package directory
 */
export function typeScript(tsconfigRootDir) {
  return [
    globalIgnores(['dist/**', '.next/**', 'coverage/**', 'next-env.d.ts']),
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node },
        parserOptions: {
          // Config files sit outside the tsconfig `include`s; lint them with default options.
          projectService: { allowDefaultProject: ['*.config.js', '*.config.mjs', '*.config.ts'] },
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', ignoreRestSiblings: true },
        ],
        // The API logs through Nest's Logger (pino); scripts that print on purpose say so with a disable comment.
        'no-console': 'error',
        // `async` without `await` is deliberate here (mocks, interface methods, Next's async config) and
        // no-floating-promises already catches the mistakes that matter.
        '@typescript-eslint/require-await': 'off',
      },
    },
    {
      // Jest/Vitest matchers and hand-rolled mocks are typed `any`; the unsafe-* family is noise there.
      files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/prefer-promise-reject-errors': 'off',
      },
    },
    { files: ['**/*.js', '**/*.mjs', '**/*.cjs'], ...tseslint.configs.disableTypeChecked },
  ];
}
