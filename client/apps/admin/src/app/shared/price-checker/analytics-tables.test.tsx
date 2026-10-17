// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { AnalyticsTables } from './analytics-tables';
import type { KioskAnalytics } from './types';
afterEach(cleanup);
const data: KioskAnalytics = {
  range: { from: '2026-10-01', to: '2026-10-13', page: 2 },
  overview: {
    total: 7,
    successful: 6,
    unknown: 1,
    uniqueProducts: 1,
    mostActiveKiosk: 'Counter',
    today: 0,
    week: 0,
    month: 7,
  },
  hours: [{ hour: 14, scans: 7 }],
  popular: [],
  lowStock: [],
  unknown: [],
  hasMore: false,
};
test('empty table pages do not claim that the whole reporting period has no matches', () => {
  render(<AnalyticsTables data={data} />);
  expect(screen.queryByText('No matching scans in this period.')).toBeNull();
  expect(
    screen.getAllByText(
      'No rows on this page. Check previous pages for more results.'
    )
  ).toHaveLength(3);
});
test('missing quantity is labeled unavailable instead of a blank stock cell', () => {
  render(
    <AnalyticsTables
      data={{
        ...data,
        lowStock: [
          {
            kiosk: 'one',
            kioskName: 'Counter',
            barcode: '000123',
            productName: 'Water',
            scans: 4,
            currentPrice: 1200,
            currency: 'NGN',
          },
        ],
      }}
    />
  );
  expect(screen.getByText('Unavailable')).toBeDefined();
  expect(screen.getByText('000123')).toBeDefined();
});
test('invalid price metadata cannot crash the report', () => {
  expect(() =>
    render(
      <AnalyticsTables
        data={{
          ...data,
          popular: [
            {
              kiosk: 'one',
              kioskName: 'Counter',
              barcode: '000123',
              productName: 'Water',
              scans: 4,
              currentPrice: 1200,
              currency: 'invalid-currency',
            },
          ],
        }}
      />
    )
  ).not.toThrow();
  expect(screen.getByText('Unavailable')).toBeDefined();
});
test('zero activity explains the empty chart rather than rendering an unlabeled blank', () => {
  render(
    <AnalyticsTables
      data={{
        ...data,
        hours: Array.from({ length: 24 }, (_, hour) => ({ hour, scans: 0 })),
      }}
    />
  );
  expect(screen.getByText('No hourly activity in this period.')).toBeDefined();
});
