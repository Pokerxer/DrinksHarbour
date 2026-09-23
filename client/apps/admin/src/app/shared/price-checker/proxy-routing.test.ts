import { expect, test, vi } from 'vitest';
vi.mock('next-auth/middleware', () => ({ default: (handler: unknown) => handler }));
import { config } from '../../../middleware';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('customer screen and proxy live in admin, separate from attendance and gated management', () => {
  expect(existsSync(resolve('src/app/kiosk/price-checker/[kioskSlug]/page.tsx'))).toBe(true);
  expect(existsSync(resolve('src/app/kiosk/[token]/page.tsx'))).toBe(true);
  expect(existsSync(resolve('src/app/api/price-checker/[...path]/route.ts'))).toBe(true);
  expect(config.matcher.some((path) => path.startsWith('/kiosk'))).toBe(false);
  expect(config.matcher).toContain('/retail-tools/:path*');
});
