import { expect, it } from 'vitest';
import type { SalesOrder } from '@/services/salesOrder.service';
import { operationsQuantity } from './sales-operations-helpers';

it('queue quantities exclude presentation lines and keep returns separate from unshipped goods', () => {
  const order = {
    items: [
      { lineType: 'product', quantity: 10, fulfilledQty: 3, returnedQty: 1 },
      { lineType: 'section', quantity: 500, returnedQty: 500 },
      { lineType: 'note', quantity: 500, returnedQty: 500 },
      { quantity: 2, fulfilledQty: 0, returnedQty: 0 },
    ],
  } as SalesOrder;
  expect(operationsQuantity(order, 'fulfill')).toBe(9);
  expect(operationsQuantity(order, 'returns')).toBe(1);
  expect(order.items[0].fulfilledQty).toBe(3);
});
