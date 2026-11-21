// @ts-check
import { defineConfig } from 'eslint/config';
import { typeScript } from '../../eslint.base.mjs';

export default defineConfig(typeScript(import.meta.dirname));
