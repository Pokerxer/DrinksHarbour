// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { InventoryMovement } from '@/services/inventory.service';
import { sortMovements, groupMovements } from './inventory-movement-groups';
import { matchesMovement, movementBounds } from './inventory-movement-view';
import { useMovementFilterState } from './use-movement-filter-state';

afterEach(() => {
  cleanup();
  localStorage.clear();
});
const row = (id: string, changes: Partial<InventoryMovement> = {}) =>
  ({
    _id: id,
    type: 'received',
    category: 'in',
    status: 'confirmed',
    quantity: 5,
    createdAt: '2026-10-04T12:00:00Z',
    warehouse: { _id: 'city', name: 'City' },
    subProduct: { _id: 'p', name: 'Wine', sku: 'WINE' },
    ...changes,
  }) as InventoryMovement;
const ids = (rows: InventoryMovement[]) => rows.map((r) => r._id);

it('sorts signed posted changes, actual warehouse names and natural references', () => {
  const incoming = row('in', {
    type: 'transfer_in',
    reference: 'TRF-2',
    sourceWarehouse: { _id: 'depot', name: 'Depot' },
    destinationWarehouse: { _id: 'city', name: 'City' },
  });
  const outgoing = row('out', {
    type: 'transfer_out',
    quantity: 2,
    reference: 'TRF-10',
    warehouse: { _id: 'depot', name: 'Depot' },
    sourceWarehouse: incoming.sourceWarehouse,
    destinationWarehouse: incoming.destinationWarehouse,
  });
  expect(ids(sortMovements([incoming, outgoing], 'qty', 'asc'))).toEqual(['out', 'in']);
  expect(ids(sortMovements([outgoing, incoming], 'warehouse', 'asc'))).toEqual(['in', 'out']);
  expect(ids(sortMovements([outgoing, incoming], 'reference', 'asc'))).toEqual(['in', 'out']);
});
it('keeps unavailable costs last in both directions and breaks ties consistently', () => {
  const rows = [row('missing'), row('zero', { totalCost: 0 }), row('priced', { totalCost: 40 })];
  expect(ids(sortMovements([...rows], 'cost', 'asc'))).toEqual(['zero', 'priced', 'missing']);
  expect(ids(sortMovements([...rows], 'cost', 'desc'))).toEqual(['priced', 'zero', 'missing']);
  expect(ids(sortMovements([row('b'), row('a')], 'product', 'asc'))).toEqual(['a', 'b']);
});
it('does not silently treat unknown sources as manual', () => {
  expect(
    groupMovements([row('unknown'), row('manual', { source: 'manual' })], 'source').map(
      ([label]) => label,
    ),
  ).toEqual(['—', 'Manual']);
});
it('rejects impossible dates and times without rolling over to another day', () => {
  expect(movementBounds('2026-02-30', '', '00:00', '23:59').error).toBeTruthy();
  expect(movementBounds('2026-10-04', '', '24:00', '23:59').error).toBeTruthy();
  expect(movementBounds('2028-02-29', '', '00:00', '23:59').error).toBe('');
});
it('searches receipt origin labels only in receipt views and trims product IDs', () => {
  const purchase = row('purchase', { relatedPurchaseOrder: 'po' });
  expect(matchesMovement(purchase, { search: 'missing; purchase receipt', receipt: true })).toBe(
    true,
  );
  expect(matchesMovement(purchase, { search: 'purchase receipt' })).toBe(false);
  expect(matchesMovement(purchase, { products: 'other, p ' })).toBe(true);
});
it('clears custom sorting, groups, times and filters and returns to page one', () => {
  const reset = vi.fn();
  const { result } = renderHook(() => useMovementFilterState('test-history', reset));
  act(() => result.current.handleSort('qty'));
  expect(result.current.hasAnyFilter).toBe(true);
  act(() => {
    result.current.setTimeFrom('10:00');
    result.current.setSearch('wine');
    result.current.setGroupBy('source');
    result.current.clearAllFilters();
  });
  expect(result.current).toMatchObject({
    sortCol: 'date',
    sortDir: 'desc',
    timeFrom: '00:00',
    timeTo: '23:59',
    search: '',
    groupBy: null,
    hasAnyFilter: false,
  });
  expect(reset).toHaveBeenCalled();
});
