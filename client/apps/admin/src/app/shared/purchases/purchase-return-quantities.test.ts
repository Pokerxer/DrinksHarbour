import { expect, it } from 'vitest';
import {
  invoiceReturnQuantities,
  returnablePurchaseQuantity,
  purchaseReturnKey,
  purchaseReturnUnitPrice,
} from './purchase-return-quantities';
it('zero receipts cannot be returned, even when ordered quantity is positive', () => {
  expect(
    returnablePurchaseQuantity(
      { subProductId: 'p', sizeId: 's', quantity: 10, receivedQty: 0 },
      {},
    ),
  ).toBe(0);
});
it('return quantities belong to a product and size together', () => {
  const small = { subProductId: 'p', sizeId: 's', quantity: 10, receivedQty: 10, returnedQty: 2 };
  const large = { ...small, sizeId: 'l' };
  expect(returnablePurchaseQuantity(small, { [purchaseReturnKey(small)]: 4 })).toBe(6);
  expect(returnablePurchaseQuantity(large, { [purchaseReturnKey(small)]: 4 })).toBe(10);
});
it('the return price uses the original purchase line snapshot', () => {
  expect(purchaseReturnUnitPrice({ quantity: 10, totalCost: 900, unitCost: 100 })).toBe(90);
});

it('whole-invoice selection caps each product size to the invoice and pending drafts', async () => {
  const { wholeInvoiceReturnQuantities } = await import('./purchase-return-quantities');
  const items = [
    { subProductId: 'a', sizeId: 's', quantity: 10, receivedQty: 8 },
    { subProductId: 'b', sizeId: 's', quantity: 10, receivedQty: 0 },
    { subProductId: 'c', sizeId: 'l', quantity: 10, receivedQty: 10 },
  ];
  expect(wholeInvoiceReturnQuantities(items, { 'a:s': 2 }, { 'a:s': 4, 'b:s': 10 })).toEqual([
    4, 0, 0,
  ]);
  expect(wholeInvoiceReturnQuantities(items, { 'a:s': 2 })).toEqual([6, 0, 10]);
});

it('subtracts invoice returns without deducting confirmed returns twice on an adjusted bill', () => {
  const items = [{ subProductId: 'a', quantity: 10 }];
  const returns = [
    { vendorBill: 'b', status: 'draft', items: [{ subProductId: 'a', quantity: 2 }] },
    { vendorBill: { _id: 'b' }, status: 'refunded', items: [{ subProductId: 'a', quantity: 3 }] },
    { vendorBill: 'other', status: 'confirmed', items: [{ subProductId: 'a', quantity: 4 }] },
    { vendorBill: 'b', status: 'cancelled', items: [{ subProductId: 'a', quantity: 8 }] },
  ];
  expect(invoiceReturnQuantities(items, returns, 'b', false)).toEqual({ 'a:': 5 });
  expect(invoiceReturnQuantities(items, returns, 'b', true)).toEqual({ 'a:': 8 });
});
