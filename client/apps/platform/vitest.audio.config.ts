import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', maxWorkers: 1, include: ['src/components/Product/Detail/description-audio.test.tsx', 'src/app/categories/**/*.test.tsx'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
