import { describe, it, expect } from 'vitest';
import { computeRefundedMap } from './refund-quantities';
describe('refund eligibility after a stock return', () => {
  it('allows paying a refund for stock already returned in Sales', () => {
    expect(computeRefundedMap([
      { source: 'sales', items: [{ orderItemIndex: 0, quantity: 6 }] },
      { items: [{ orderItemIndex: 0, quantity: 2 }] },
    ])).toEqual({ 0: 2 });
  });
});

import { computeReturnedMap } from './refund-quantities';
it('counts Sales and POS returns and subtracts historical overlap once', () => {
 expect(computeReturnedMap([
  {source:'sales',items:[{orderItemIndex:0,quantity:6}]},
  {items:[{orderItemIndex:0,quantity:4,salesReturnedQuantity:2}]},
 ])).toEqual({0:8});
});
it('marks all 138 units of SO00008 returned', () => {
 expect(computeReturnedMap([{source:'sales',items:[{orderItemIndex:0,quantity:60},{orderItemIndex:1,quantity:60},{orderItemIndex:2,quantity:18}]}])).toEqual({0:60,1:60,2:18});
});
