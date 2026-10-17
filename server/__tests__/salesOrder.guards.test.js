// server/__tests__/salesOrder.guards.test.js
const test = require('node:test');
const assert = require('node:assert');
const { canEdit, canCancel, applyEdit } = require('../services/salesOrder.service');

test('canEdit: quotation editable in draft/sent only', () => {
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'draft' }), true);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'sent' }), true);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'accepted' }), false);
  assert.strictEqual(canEdit({ docType: 'quotation', quoteStatus: 'converted' }), false);
});

test('canEdit: order editable in draft only', () => {
  assert.strictEqual(canEdit({ docType: 'order', orderStatus: 'draft' }), true);
  assert.strictEqual(canEdit({ docType: 'order', orderStatus: 'confirmed' }), false);
});

test('canCancel blocks fulfilled/converted/cancelled', () => {
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'confirmed' }), true);
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'fulfilled' }), false);
  assert.strictEqual(canCancel({ docType: 'quotation', quoteStatus: 'converted' }), false);
  assert.strictEqual(canCancel({ docType: 'order', orderStatus: 'cancelled' }), false);
});

test('applyEdit replaces lines and recomputes totals', async () => {
  const so = { items: [], subtotal: 0, total: 0 };
  await applyEdit(so, { items: [{ product: 'p', subproduct: 's', size: 'z', quantity: 2, unitPrice: 1500, discount: 100 }] });
  assert.strictEqual(so.items[0].lineTotal, 2900); // 1500*2 - flat ₦100 off the line
  assert.strictEqual(so.total, 2900);
});

test('locked sales documents cannot edit, cancel or bypass lock through bulk actions', async () => {
  const svc = require('../services/salesOrder.service');
  const doc = {docType:'order',orderStatus:'draft',locked:true,save:async()=>{throw new Error('must not save');}};
  assert.equal(svc.canEdit(doc),false);
  assert.equal(svc.canCancel(doc),false);
  await assert.rejects(svc.bulkCancelDoc(doc),/locked|unlock/i);
  await assert.rejects(svc.bulkDeleteDoc(doc),/locked|unlock/i);
});

test('cancellation rejects paid or delivered evidence despite stale lifecycle statuses', () => {
  const base = {docType:'order',orderStatus:'confirmed'};
  for (const evidence of [
    {amountPaid:1}, {paymentStatus:'paid'}, {paymentStatus:'partial'},
    {items:[{fulfilledQty:1,returnedQty:1}]},
    {fulfillments:[{items:[{qty:1}]}]},
    {orderStatus:'partially_fulfilled'}, {invoiceIssuedAt:new Date()},
  ]) assert.equal(canCancel({...base,...evidence}),false,JSON.stringify(evidence));
});
