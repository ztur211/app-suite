import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

const PROVIDER_SDK_MODULES = ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      '**/node_modules/**',
      '**/prisma/generated/**',
      '**/*.config.js',
      '**/*.config.cjs',
      'apps/**/*.config.mjs',
      'apps/**/*.config.ts',
      'packages/**/*.config.mjs',
      'packages/**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: PROVIDER_SDK_MODULES.map((name) => ({
            name,
            message:
              'Direct provider SDK imports are only allowed in packages/ai/src/providers/. Use @things/ai instead.',
          })),
        },
      ],
    },
  },
  {
    files: ['packages/ai/src/providers/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  prettierConfig,
);
