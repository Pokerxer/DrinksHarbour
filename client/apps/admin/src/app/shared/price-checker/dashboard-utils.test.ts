import { expect, test } from 'vitest';
import { filterKiosks, kioskLabels } from './dashboard-utils';
import type { Kiosk, KioskOptions } from './types';
const options = {
  shops: [{ _id: 'retail', name: 'Wyn City' }],
  locations: [{ _id: 'branch', name: 'Maitama' }],
  pricelists: [],
} as unknown as KioskOptions;
const rows = [
  {
    _id: 'a',
    name: 'Front counter',
    internalId: '001',
    slug: 'front',
    shopId: 'retail',
    location: 'branch',
    enabled: true,
  },
  { _id: 'b', name: 'Back counter', internalId: '002', slug: 'back', enabled: false },
] as Kiosk[];
test('search matches store and branch names and combines with status', () => {
  expect(filterKiosks(rows, '  MAITAMA ', 'enabled', options).map((k) => k._id)).toEqual(['a']);
  expect(filterKiosks(rows, 'counter', 'disabled', options).map((k) => k._id)).toEqual(['b']);
  expect(filterKiosks(rows, 'unknown', 'all', options)).toEqual([]);
});
test('missing assignments are explicit; default pricing is distinguished from removed lists', () => {
  expect(kioskLabels(rows[1], options).location).toBe('Location unavailable');
  expect(kioskLabels(rows[0], options).pricelist).toBe('Automatic retail pricing');
  expect(kioskLabels({ ...rows[0], pricelist: 'gone' }, options).pricelist).toBe(
    'Pricelist unavailable'
  );
});
