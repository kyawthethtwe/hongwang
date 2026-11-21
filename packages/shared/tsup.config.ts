import { defineConfig } from 'tsup';

export default defineConfig({
  // `phone` is its own entry ('@hongwang/shared/phone') so its metadata stays out of the root bundle.
  entry: ['src/index.ts', 'src/phone.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: false, // other packages typecheck against dist while it rebuilds
  target: 'es2022',
});
