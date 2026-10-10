// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import FilterPanel from './filter-panel';
afterEach(cleanup);
it('searches product choices, keeps multiple selected, and deselects only the chosen product', () => {
  const onChange = vi.fn();
  function Harness() {
    const [filters, setFilters] = useState<string[]>([]);
    return (
      <FilterPanel
        filters={filters}
        onToggleFilter={(key) =>
          setFilters((current) => {
            const next = current.includes(key)
              ? current.filter((value) => value !== key)
              : [...current, key];
            onChange(next);
            return next;
          })
        }
        products={[
          { _id: 'p1', name: 'Wine A · A1' },
          { _id: 'p2', name: 'Wine B · B1' },
        ]}
        warehouses={[{ _id: 'w1', name: 'Main' }]}
        categories={[]}
        brands={[]}
        groupByStack={[]}
        onToggleGroupBy={() => {}}
        savedSearches={[]}
        activeSearchId={null}
        onApplySearch={() => {}}
        onDeleteSearch={() => {}}
        onSaveSearch={() => {}}
      />
    );
  }
  render(<Harness />);
  fireEvent.change(
    screen.getByPlaceholderText('Find products, warehouses, categories or brands…'),
    { target: { value: 'wine' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Wine A · A1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Wine B · B1' }));
  expect(onChange).toHaveBeenLastCalledWith(['product_p1', 'product_p2']);
  expect(screen.getByRole('button', { name: 'Wine A · A1' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(screen.getByRole('button', { name: 'Wine B · B1' }).getAttribute('aria-pressed')).toBe(
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Wine A · A1' }));
  expect(onChange).toHaveBeenLastCalledWith(['product_p2']);
});

it('saves a named favorite and restores an existing product selection', () => {
  const save = vi.fn();
  const apply = vi.fn();
  const favorite = {
    id: 'fav',
    name: 'Wine in Main',
    filters: ['product_p1', 'warehouse_w1'],
    groupBy: null,
    groupBy2: null,
    measure: 'stock_value' as const,
  };
  render(
    <FilterPanel
      filters={favorite.filters}
      onToggleFilter={() => {}}
      products={[{ _id: 'p1', name: 'Wine' }]}
      warehouses={[{ _id: 'w1', name: 'Main' }]}
      categories={[]}
      brands={[]}
      groupByStack={[]}
      onToggleGroupBy={() => {}}
      savedSearches={[favorite]}
      activeSearchId="fav"
      onApplySearch={apply}
      onDeleteSearch={() => {}}
      onSaveSearch={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Wine in Main' }));
  expect(apply).toHaveBeenCalledWith(favorite);
  fireEvent.click(screen.getByRole('button', { name: 'Save current view' }));
  fireEvent.change(screen.getByPlaceholderText('Search name…'), {
    target: { value: '  My products  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith('My products');
});
