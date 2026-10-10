import { expect, it } from 'vitest';
import { reviewForecast, selectForecasts } from './forecast-rules';
import type { InsightLine } from '@/services/notificationInsights.service';
const line = (key: string, available: number | null = 10) =>
  ({
    key,
    productName: key,
    sizeName: '75cl',
    sku: key,
    warehouseId: 'w',
    warehouseName: 'Main',
    available,
    committedOutboundUnits: 2,
    forecast: {
      method: 'historical_baseline',
      startDate: '2026-10-08T23:00:00Z',
      daily: Array(90).fill(1),
      historyDays: 42,
    },
    incoming: [
      { quantity: 3, arrival: '2026-10-12T12:00:00Z' },
      { quantity: 99, arrival: null },
      { quantity: 99, arrival: '2026-10-08T12:00:00Z' },
      { quantity: 99, arrival: '2026-10-15T23:00:00Z' },
    ],
  }) as InsightLine;
it('projects the chosen horizon using commitments and only timely arrivals', () => {
  const r = reviewForecast(line('p'), 7);
  expect(r.demand).toBe(7);
  expect(r.incoming).toBe(3);
  expect(r.balance).toBe(4);
  expect(r.shortfall).toBe(0);
  expect(reviewForecast(line('p'), 14).shortfall).toBe(0);
});
it('missing demand and stock never become zero orders; tenant summary has no local shortfall', () => {
  expect(
    reviewForecast(
      {
        ...line('p'),
        forecast: {
          ...line('p').forecast!,
          method: 'insufficient_history',
          daily: [],
        },
      },
      30
    ).demand
  ).toBeNull();
  expect(reviewForecast(line('p', null), 30).shortfall).toBeNull();
  expect(
    reviewForecast({ ...line('p'), summary: true }, 30).shortfall
  ).toBeNull();
});
it('sorts the selected horizon rather than the fixed monthly total and keeps missing history last', () => {
  const a = line('A'),
    b = line('B');
  a.forecast!.daily = Array(90)
    .fill(0)
    .map((_, i) => (i < 7 ? 10 : 0));
  b.forecast!.daily = Array(90).fill(2);
  const missing = {
    ...line('Missing'),
    forecast: {
      ...a.forecast!,
      daily: [],
      method: 'insufficient_history' as const,
    },
  };
  expect(
    selectForecasts([a, b, missing], '', 'all', 'demand', 7).map((l) => l.key)
  ).toEqual(['A', 'B', 'Missing']);
  expect(
    selectForecasts([a, b, missing], '', 'all', 'demand', 90).map((l) => l.key)
  ).toEqual(['B', 'A', 'Missing']);
});
it('flags a shortage before a future delivery even when ending stock is positive', () => {
  const row = {
    ...line('p', 2),
    committedOutboundUnits: 0,
    incoming: [
      {
        quantity: 20,
        arrival: '2026-10-12T12:00:00Z',
        source: 'purchase',
        reference: 'PO',
      },
    ],
  };
  const r = reviewForecast(row, 7);
  expect(r.balance).toBe(15);
  expect(r.shortfall).toBe(1);
  expect(r.attention).toBe(true);
  expect(r.stockoutDay).toBe(2);
});
it('overdue arrivals earlier today cannot conceal current shortages', () => {
  const row = {
    ...line('p', 1),
    committedOutboundUnits: 0,
    incoming: [
      {
        quantity: 50,
        arrival: '2026-10-09T08:00:00Z',
        source: 'purchase',
        reference: 'PO',
      },
    ],
  };
  const r = reviewForecast(row, 7, '2026-10-09T12:00:00Z');
  expect(r.incoming).toBe(0);
  expect(r.shortfall).toBe(6);
});
