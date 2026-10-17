// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StatsHeader } from './StatsHeader';
import { filterSubProducts, type SubProductListItem } from '../filtering';
import { nextWidgetFilter, summarizeWidgets } from '../widget-summary';

afterEach(cleanup);
const items = [
  {
    _id: 'active-row',
    status: 'active',
    totalStock: 12,
    lowStockThreshold: 15,
    createdAt: '2026-10-01',
  },
  { _id: 'empty-row', status: 'draft', totalStock: 0, createdAt: '2026-10-01' },
] as SubProductListItem[];

function WidgetList() {
  const [statusFilter, setStatusFilter] = useState('');
  const { stats, trends } = summarizeWidgets(
    items,
    {},
    Date.parse('2026-10-11')
  );
  const rows = filterSubProducts(items, { statusFilter });
  return (
    <>
      <StatsHeader
        stats={stats}
        trends={trends}
        activeFilter={statusFilter}
        onFilterChange={(selected) =>
          setStatusFilter((current) => nextWidgetFilter(current, selected))
        }
        resultCount={rows.length}
      />
      <ul aria-label="Products">
        {rows.map((row) => (
          <li key={row._id}>{row._id}</li>
        ))}
      </ul>
    </>
  );
}

it('widget selection narrows the rows and a second click returns to Total', () => {
  render(<WidgetList />);
  const low = screen.getByRole('button', {
    name: 'Filter Low Stock: 1 products',
  });
  fireEvent.click(low);
  expect(low.getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('empty-row')).toBeNull();
  expect(screen.getByText('active-row')).toBeDefined();
  fireEvent.click(low);
  expect(screen.getByText('empty-row')).toBeDefined();
  expect(
    screen
      .getByRole('button', { name: 'Filter Total: 2 products' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter Out of Stock: 1 products' })
  );
  expect(screen.queryByText('active-row')).toBeNull();
});

it('failed summaries display unavailable counts and provide retry without applying a filter', () => {
  const retry = vi.fn();
  const change = vi.fn();
  render(
    <StatsHeader
      stats={{ total: 0, active: 0, lowStock: 0, outOfStock: 0 }}
      activeFilter=""
      onFilterChange={change}
      unavailable
      onRetry={retry}
    />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Filter Active: unavailable products' })
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry summary' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
