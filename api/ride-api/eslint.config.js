import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    ignores: ['dist/**', 'node_modules/**']
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // TS already knows the runtime types better than core rules
      'no-undef': 'off',

      // Allow pragmatic any usage in glue code (Fastify hooks, AJV plugin, etc)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Prefer TS' unused-vars checking in editor; keep ESLint lightweight
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },

  {
    files: ['test/**/*.mjs'],
    languageOptions: {
      sourceType: 'module'
    }
  }
];
