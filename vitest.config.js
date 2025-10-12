import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // or 'node' for non-DOM tests
    globals: true,
    setupFiles: './src/setupTests.js', // for frontend tests
    include: ['src/**/*.test.{js,jsx}'], // include only src tests
  },
  resolve: {
    alias: {
      '~/': `${__dirname}/`,
    },
  },
});