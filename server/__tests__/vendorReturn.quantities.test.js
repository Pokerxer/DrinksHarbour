const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../controllers/vendorReturn.controller');
const PurchaseOrder = require('../models/PurchaseOrder');
const VendorReturn = require('../models/VendorReturn');
const stock = require('../services/vendorReturn.stock');
test('cannot confirm a return larger than the matching received purchase size', async t => {
  t.mock.method(VendorReturn, 'findOne', async () => ({ status: 'draft', purchaseOrder: 'po',
    items: [{ subProductId: 'sp', sizeId: 'small', quantity: 3 }] }));
  t.mock.method(PurchaseOrder, 'findOne', async () => ({ items: [
    { subProductId: 'sp', sizeId: 'small', receivedQty: 2, returnedQty: 0 },
    { subProductId: 'sp', sizeId: 'large', receivedQty: 20, returnedQty: 0 },
  ] }));
  let touched = false;
  t.mock.method(stock, 'applyVendorReturnStock', async () => { touched = true; throw new Error('stock touched'); });
  let error;
  await controller.updateReturnStatus({ user: { tenant: 't', _id: 'u' }, params: { id: 'r' }, body: { status: 'confirmed' } }, {}, e => { error = e; });
  assert.equal(touched, false);
  assert.match(error.message, /received/);
});
