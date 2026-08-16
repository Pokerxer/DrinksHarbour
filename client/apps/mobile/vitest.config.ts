import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // environment: 'node' matches the convention already in force in apps/admin
    // — no jsdom, components are not rendered. Logic worth testing is extracted
    // into plain functions and tested directly.
    environment: 'node',
    include: ['lib/**/*.test.mjs'],
  },
});
