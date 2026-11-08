import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.e2e-spec.ts'],
    globals: true,
    hookTimeout: 60000,
    testTimeout: 60000,
    alias: {
      '@src': './src',
    },
    root: './',
  },
});