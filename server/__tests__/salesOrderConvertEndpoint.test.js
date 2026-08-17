// server/__tests__/salesOrderConvertEndpoint.test.js
//
// The convert endpoint used to answer 201 Created and write TWO activity-log
// entries, one per document. Conversion is in place now: nothing is created and
// there is only one document to log against, so a second entry would be the same
// event recorded twice on the same order.

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();

test('convert answers 200 with the same document, and logs once', async (t) => {
  const svc = require('../services/salesOrder.service');
  const salesLog = require('../services/salesActivity.service');
  const ctrl = require('../controllers/salesOrder.controller');

  const tenantId = oid();
  const quoteId = oid();

  const quotation = {
    _id: quoteId, tenant: tenantId, soNumber: 'SO00002',
    docType: 'quotation', quoteStatus: 'accepted', items: [],
    save: async function () { return this; },
  };

  t.mock.method(svc, 'convertQuotationToOrder', async (q) => {
    q.docType = 'order';
    q.quoteStatus = 'converted';
    q.orderStatus = 'draft';
    return q;
  });

  const logged = [];
  t.mock.method(salesLog, 'logActivity', async (tenant, id) => {
    logged.push(String(id));
  });

  const SalesOrder = require('../models/SalesOrder');
  t.mock.method(SalesOrder, 'findOne', async () => quotation);

  let statusCode = 200;
  let payload;
  const req = { params: { id: String(quoteId) }, tenant: { _id: tenantId }, user: { _id: oid() }, body: {} };
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; },
  };

  await ctrl.convertQuotation(req, res, (err) => { throw err; });

  assert.strictEqual(statusCode, 200);
  assert.strictEqual(String(payload.data._id), String(quoteId));
  assert.strictEqual(payload.data.soNumber, 'SO00002');
  assert.strictEqual(payload.data.docType, 'order');
  assert.deepStrictEqual(logged, [String(quoteId)]);
});
