// The clearable-field contract between the edit screen and applyEdit.
//
// applyEdit applies every scalar with `if (body.x !== undefined)`, so
// `undefined` means "leave this field alone" and `''`/`null` mean "clear it".
// The edit form used to send `value || undefined` for notes/terms, which made
// an emptied field indistinguishable from an untouched one — the operator
// cleared the note, pressed save, and the note came straight back.
//
// These pin the server half of that contract. The client half is
// client/apps/admin/src/app/shared/sales/sales-clearable-fields.ts.
const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const svc = require('../services/salesOrder.service');

const oid = () => new mongoose.Types.ObjectId();

function baseOrder(extra = {}) {
  return {
    tenant: oid(),
    items: [],
    subtotal: 10000,
    discountTotal: 0,
    promotionTotal: 0,
    taxTotal: 0,
    total: 10000,
    couponDiscount: 0,
    shippingFee: 0,
    createdAt: new Date(),
    ...extra,
  };
}

const BANK_DETAILS =
  'Cloudbay Wyn City Enterprises Limited\n1310551509\nUBA';

test('an empty string clears notes — this is how the edit screen empties one', async () => {
  const so = baseOrder({ notes: BANK_DETAILS, terms: 'Net 30' });
  await svc.applyEdit(so, { notes: '' });
  assert.strictEqual(so.notes, '');
  // A cleared field must not disturb its neighbours.
  assert.strictEqual(so.terms, 'Net 30');
});

test('undefined leaves notes untouched, so it is NOT a way to clear them', async () => {
  const so = baseOrder({ notes: BANK_DETAILS });
  await svc.applyEdit(so, {});
  assert.strictEqual(so.notes, BANK_DETAILS);
  // The same holds for an explicit undefined, which is what `x || undefined`
  // collapses to the moment the operator empties the box.
  await svc.applyEdit(so, { notes: undefined });
  assert.strictEqual(so.notes, BANK_DETAILS);
});

test('notes and terms are independent clearable fields', async () => {
  const so = baseOrder({ notes: 'delivery note', terms: 'Net 7' });
  await svc.applyEdit(so, { terms: '' });
  assert.strictEqual(so.notes, 'delivery note');
  assert.strictEqual(so.terms, '');
});

test('a null validUntil clears the expiry date', async () => {
  const so = baseOrder({ validUntil: new Date('2026-12-31') });
  await svc.applyEdit(so, { validUntil: null });
  assert.strictEqual(so.validUntil, null);
});

test('an empty warehouseId clears the issuing warehouse', async () => {
  const so = baseOrder({ warehouseId: oid() });
  await svc.applyEdit(so, { warehouseId: null });
  assert.strictEqual(so.warehouseId, null);
});
