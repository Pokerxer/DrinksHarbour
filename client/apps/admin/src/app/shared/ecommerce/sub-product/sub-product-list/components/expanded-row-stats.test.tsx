// @vitest-environment jsdom
// The rule this file exists to protect: the Sub-Products LIST loads the whole
// catalog (limit 5000, client-side filtering), so per-row stats cannot be
// stamped server-side on every list load. The expanded row must FETCH its
// Purchased/Sold stats when it opens — from the same source-of-truth endpoint
// the detail toolbar uses — instead of reading the stale document counters
// that showed 0 for products with real purchase and sales records
// (2026-11-11 Sunblessed Vinho Branco).
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import ExpandedSubProductRow from './ExpandedSubProductRow';
import { subproductService } from '@/services/subproduct.service';
import type { SubProductListItem } from '../filtering';

vi.mock('@/services/subproduct.service', () => ({
  subproductService: { getSubProductStats: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const base = {
  _id: 'sub1',
  product: { name: 'Sunblessed Vinho Branco', type: 'wine' },
  status: 'active',
  currency: 'NGN',
  sizes: [],
  totalSold: 0,
  totalRevenue: 0,
} as unknown as SubProductListItem;

test('expanded row fetches live stats on open and shows them instead of the stale zeros', async () => {
  (subproductService.getSubProductStats as any).mockResolvedValue({
    totalSold: 5,
    totalRevenue: 61000,
    purchaseCount: 1210,
  });

  render(<ExpandedSubProductRow subProduct={base} token="tok" />);

  await waitFor(() => {
    expect(subproductService.getSubProductStats).toHaveBeenCalledWith('sub1', 'tok');
  });
  await waitFor(() => {
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('₦61,000')).toBeTruthy();
  });
});

test('expanded row keeps rendering when the stats call fails', async () => {
  (subproductService.getSubProductStats as any).mockRejectedValue(new Error('network'));
  render(<ExpandedSubProductRow subProduct={base} token="tok" />);
  // The stale document value (0) remains visible; no crash.
  await waitFor(() => {
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
