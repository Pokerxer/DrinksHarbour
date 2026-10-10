// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { usePlanningFilters } from './insight-controls';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/notifications/warehouses',
  useRouter: () => ({ replace }),
  useSearchParams: () =>
    new URLSearchParams(
      'warehouseId=unassigned&subProductId=' + 'a'.repeat(24)
    ),
}));
it('keeps the unassigned bucket in warehouse URLs and preserves the product scope on location changes', () => {
  const { result } = renderHook(() => usePlanningFilters());
  expect(result.current.warehouseId).toBe('unassigned');
  act(() => result.current.set('warehouseId', 'b'.repeat(24)));
  const query = new URLSearchParams(replace.mock.calls[0][0].split('?')[1]);
  expect(query.get('warehouseId')).toBe('b'.repeat(24));
  expect(query.get('subProductId')).toBe('a'.repeat(24));
  expect(query.get('coverDays')).toBe('14');
});
it('applies and clears timeframe atomically while retaining warehouse and product scope', () => {
  replace.mockClear();
  const { result } = renderHook(() => usePlanningFilters());
  act(() => result.current.setRange('2026-09-01', '2026-09-30'));
  const query = new URLSearchParams(replace.mock.calls[0][0].split('?')[1]);
  expect(query.get('startDate')).toBe('2026-09-01');
  expect(query.get('endDate')).toBe('2026-09-30');
  expect(query.get('warehouseId')).toBe('unassigned');
  expect(query.get('subProductId')).toBe('a'.repeat(24));
});
