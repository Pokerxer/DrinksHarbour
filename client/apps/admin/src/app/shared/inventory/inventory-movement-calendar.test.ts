import { afterEach, expect, it, vi } from 'vitest';
import { DATE_PRESETS } from './inventory-receipts-support';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it('uses local calendar dates for shortcuts including midnight and last month', () => {
  vi.stubEnv('TZ', 'Africa/Lagos');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T00:30:00+01:00'));
  const today = DATE_PRESETS.find((p) => p.label === 'Today')!;
  const last = DATE_PRESETS.find((p) => p.label === 'Last month')!;
  expect(today.from()).toBe('2026-10-01');
  expect(today.to()).toBe('2026-10-01');
  expect(last.from()).toBe('2026-09-01');
  expect(last.to()).toBe('2026-09-30');
});
