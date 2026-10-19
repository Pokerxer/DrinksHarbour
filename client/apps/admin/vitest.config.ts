import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Next.js compiles TSX with the automatic JSX runtime, so component files in
  // `src/` do not import React. Without this, esbuild under Vitest would transform
  // them with the classic runtime and every render would throw "React is not
  // defined" — which is about the test harness, not the component.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/browser-observers.ts'],
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
      '@core': path.resolve(__dirname, '../../packages/isomorphic-core/src'),
    },
  },
});
