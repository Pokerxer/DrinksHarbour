import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  // Next uses string plugin names; Vite needs plugin objects. DOM tests do not
  // assert generated CSS, so skip PostCSS here and verify scrolling in-browser.
  css: { postcss: { plugins: [] } },
  test: { environment: 'jsdom', maxWorkers: 1, include: ['src/components/Shop/**/*.test.tsx', 'src/components/Merchandising/**/*.test.tsx', 'src/components/Stores/**/*.test.tsx', 'src/components/Brands/**/*.test.tsx', 'src/app/brands/**/*.test.tsx'] },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
