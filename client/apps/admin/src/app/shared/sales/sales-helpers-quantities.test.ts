import { expect, it } from 'vitest';
import type { SalesLineItem } from '@/services/salesOrder.service';
import { outstanding } from './sales-helpers';

it('returned shipped goods cannot cancel goods that have not been delivered', () => {
  const line = { quantity: 10, fulfilledQty: 6, returnedQty: 4 } as SalesLineItem;
  expect(outstanding(line)).toBe(4);
  expect(outstanding({ ...line, fulfilledQty: 10 })).toBe(0);
});
