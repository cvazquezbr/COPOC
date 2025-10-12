import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/api/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      '~/': `${__dirname}/`,
    },
  },
});