import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('http://127.0.0.1:5197') },
});
