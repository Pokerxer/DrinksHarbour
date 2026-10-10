import { expect, it } from 'vitest';
import { stockReturnValue } from './stock-return-value';
it('uses the sold line value proportionally, not synthetic zero refund prices', () => {
  expect(stockReturnValue({quantity:10,priceAtPurchase:100,itemSubtotal:900},4)).toEqual({unitPrice:100,value:360});
});
it('preserves a genuinely free item and reports missing prices as unknown', () => {
  expect(stockReturnValue({quantity:10,priceAtPurchase:100,itemSubtotal:0},4).value).toBe(0);
  expect(stockReturnValue(undefined,4)).toEqual({unitPrice:null,value:null});
});
it('falls back to the original price less recorded discount', () => {
  expect(stockReturnValue({quantity:10,priceAtPurchase:100,discountAmount:100},4).value).toBe(360);
});
