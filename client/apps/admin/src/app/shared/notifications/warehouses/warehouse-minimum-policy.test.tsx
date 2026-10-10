// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { it, expect, afterEach } from 'vitest';
import WarehouseMinimumPolicy from './warehouse-minimum-policy';
afterEach(cleanup);
it('explains computed demand and safety separately, without presenting assumed lead as observed', () => {
  render(
    <WarehouseMinimumPolicy
      policy={{
        status: 'active',
        units: 9,
        leadUnits: 7,
        safetyUnits: 2,
        leadDays: 7,
        leadSource: 'planning_default',
        calculatedAt: '2026-10-09',
      }}
      demand
    />
  );
  expect(screen.getByText(/Automatic minimum.*9 units/)).toBeTruthy();
  expect(screen.getByText(/7-day planning assumption/)).toBeTruthy();
});
it('insufficient history keeps a labelled fallback, and stock-only access hides inputs', () => {
  const { rerender } = render(
    <WarehouseMinimumPolicy policy={{ status: 'learning', units: 10 }} demand />
  );
  expect(screen.getByText(/7 dated local days/)).toBeTruthy();
  rerender(
    <WarehouseMinimumPolicy
      policy={{
        status: 'active',
        units: 9,
        leadUnits: 7,
        safetyUnits: 2,
        leadDays: 7,
      }}
      demand={false}
    />
  );
  expect(screen.queryByText(/safety units/)).toBeNull();
});

it('labels early minima as estimates and preserves the history boundary', () => {
  render(
    <WarehouseMinimumPolicy
      policy={{
        status: 'active',
        confidence: 'early',
        units: 17,
        leadUnits: 6,
        safetyUnits: 11,
        leadDays: 7,
        leadSource: 'planning_default',
        historyDays: 7,
        method: 'short_history_baseline',
      }}
      demand
    />
  );
  expect(screen.getByText(/Automatic estimate.*17 units/)).toBeTruthy();
  expect(screen.getByText(/7 days of recorded local history/)).toBeTruthy();
  expect(screen.getByText(/Early sales baseline/)).toBeTruthy();
});

it('explains transfer outflow as demand for distribution warehouse minimums', () => {
  render(
    <WarehouseMinimumPolicy
      policy={{
        status: 'active',
        units: 18,
        demandBasis: 'transfers',
        leadUnits: 14,
        safetyUnits: 4,
        leadDays: 7,
      }}
      demand
    />
  );
  expect(screen.getByText(/posted transfers out/)).toBeTruthy();
});
