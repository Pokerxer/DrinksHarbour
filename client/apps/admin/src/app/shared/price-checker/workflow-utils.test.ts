import { expect, test } from 'vitest';
import { datePreset, reportDateError, setupError, suggestedSlug } from './workflow-utils';
import type { KioskInput, KioskOptions } from './types';
test('report presets use Lagos dates across UTC midnight and leap days', () => {
  expect(datePreset(7, new Date('2026-09-22T23:30:00Z'))).toEqual({
    from: '2026-09-17',
    to: '2026-09-23',
  });
  expect(datePreset(1, new Date('2024-02-29T12:00:00Z'))).toEqual({
    from: '2024-02-29',
    to: '2024-02-29',
  });
});
test('report validation rejects rollover dates, reversed and oversized ranges', () => {
  expect(reportDateError('2026-02-30', '2026-03-01')).toBeTruthy();
  expect(reportDateError('2026-09-23', '2026-09-22')).toBeTruthy();
  expect(reportDateError('2020-01-01', '2026-09-22')).toBeTruthy();
  expect(reportDateError('2026-09-01', '2026-09-22')).toBe('');
});
test('suggested URLs normalize accents, punctuation and repeated spacing', () => {
  expect(suggestedSlug('  Café / Maitama  Counter! ')).toBe('cafe-maitama-counter');
});
test('setup refuses stale assignments and ineligible pricelists', () => {
  const options = {
    shops: [{ _id: 'retail', location: 'branch' }],
    locations: [{ _id: 'branch' }],
    pricelists: [],
  } as unknown as KioskOptions;
  const input = {
    shopId: 'retail',
    location: 'branch',
    pricelist: null,
    currency: 'NGN',
    name: 'Counter',
    internalId: 'ID',
    slug: 'counter',
    settings: { resetSeconds: 8, logo: '' },
  } as KioskInput;
  expect(setupError(input, options)).toBe('');
  expect(setupError({ ...input, location: 'other' }, options)).toBeTruthy();
  expect(setupError({ ...input, pricelist: 'removed' }, options)).toBeTruthy();
  expect(
    setupError({ ...input, settings: { ...input.settings, resetSeconds: 3.5 } }, options)
  ).toBeTruthy();
  expect(
    setupError(
      { ...input, settings: { ...input.settings, logo: 'http://unsafe.test/logo' } },
      options
    )
  ).toBeTruthy();
});
