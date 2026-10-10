import { it, expect } from 'vitest';
import { selectOrderGroups, currencyTotals } from './vendor-order-rules';
import type { OrderGroup } from './order-draft';
const groups = [
  {
    key: 'a',
    vendorName: 'Alpha',
    currency: 'NGN',
    warehouseName: 'Main',
    estimatedCost: 1000,
    lines: [
      {
        productName: 'Wine',
        sku: 'W1',
        sizeName: '75cl',
        selected: { quantity: 6, urgency: 'normal' },
      },
    ],
  },
  {
    key: 'b',
    vendorName: 'Beta',
    currency: 'USD',
    warehouseName: 'Store',
    estimatedCost: 20,
    lines: [
      {
        productName: 'Beer',
        sku: 'B1',
        sizeName: 'Bottle',
        selected: { quantity: 12, urgency: 'urgent' },
      },
    ],
  },
] as OrderGroup[];
it('searches suppliers, destination and included product SKUs without changing groups', () => {
  expect(
    selectOrderGroups(groups, 'b1', 'all', 'priority').map((g) => g.key)
  ).toEqual(['b']);
  expect(
    selectOrderGroups(groups, 'main', 'NGN', 'supplier').map((g) => g.key)
  ).toEqual(['a']);
  expect(selectOrderGroups(groups, 'alpha', 'USD', 'supplier')).toEqual([]);
  expect(groups[0].lines).toHaveLength(1);
});
it('prioritises urgent orders and keeps monetary totals in separate currencies', () => {
  expect(
    selectOrderGroups(groups, '', 'all', 'priority').map((g) => g.key)
  ).toEqual(['b', 'a']);
  expect(currencyTotals(groups)).toEqual([
    { currency: 'NGN', total: 1000 },
    { currency: 'USD', total: 20 },
  ]);
});
