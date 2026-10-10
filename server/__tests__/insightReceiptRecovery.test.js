const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recoverInsightReceipts } = require('../services/insightReceiptRecovery');
const { uncertainProducts } = require('../services/tenantProductInsights.salesEvidence');
const { normalizeOrderUnits, normalizeSalesUnits } = require('../services/tenantProductInsights.sales');
const so = { _id: 'so', tenant: 't', docType: 'order', orderStatus: 'fulfilled', paymentStatus: 'paid',
  items: [{ _id: 'line', subproduct: 'p', size: 's', fulfilledQty: 6, returnedQty: 1 }],
  fulfillments: [{ ref: 'RCP-1', status: 'reconciled', at: '2026-08-16', items: [{ lineId: 'line', qty: 6 }] }] };
const receipt = { _id: 'r', source: 'pos', receiptNumber: 'RCP-1', paymentStatus: 'paid',
  createdAt: '2026-08-16', items: [{ tenant: 't', subproduct: 'p', size: 's', warehouse: 'w', quantity: 6 }] };
test('explicit reconciled receipt reference recovers missing links without writing historic data', () => {
  const [recovered] = recoverInsightReceipts([so], [receipt], 't');
  assert.equal(recovered.tenant, 't');
  assert.equal(recovered.linkedSalesOrder, 'so');
  assert.equal(receipt.tenant, undefined);
  assert.equal(receipt.linkedSalesOrder, undefined);
  assert.equal(uncertainProducts([so], [recovered]).size, 0);
  assert.equal(normalizeSalesUnits(so, [recovered], 't', { locations: true }).length, 0);
  const { buildLinkedReturnState } = require('../services/linkedReturns.helpers');
  const returns = buildLinkedReturnState(so, [recovered]).salesByReceipt.r;
  const [row] = normalizeOrderUnits({ ...recovered, projectedSalesReturns: returns }, 't', { locations: true });
  assert.equal(row.units, 5);
  assert.equal(row.warehouseId, 'w');
});
test('receipt recovery rejects foreign or mixed tenants, ambiguous references and conflicting links', () => {
  for (const candidate of [
    { ...receipt, tenant: 'foreign' },
    { ...receipt, linkedSalesOrder: 'other' },
    { ...receipt, items: [...receipt.items, { tenant: 'foreign', subproduct: 'p', size: 's' }] },
    { ...receipt, receiptNumber: 'unknown' },
    { ...receipt, items: [{ ...receipt.items[0], size: 'other' }] },
  ]) assert.equal(recoverInsightReceipts([so], [candidate], 't')[0].linkedSalesOrder, candidate.linkedSalesOrder);
  assert.equal(recoverInsightReceipts([so, { ...so, _id: 'duplicate' }], [receipt], 't')[0].linkedSalesOrder, undefined);
});
