import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // `auth-options.ts` imports `env.mjs`, which validates the schema at import
    // time. Supply the minimum so importing it under test does not throw.
    env: {
      NEXTAUTH_SECRET: 'test-secret',
      NEXTAUTH_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Matches tsconfig: @core is the shared isomorphic-core package, not a
      // local folder. The old ./src/@core target does not exist.
      '@core': path.resolve(
        __dirname,
        '../../packages/isomorphic-core/src'
      ),
    },
  },
});
