const test = require('node:test');
const assert = require('node:assert');
const svc = require('../services/subProductImport.service');

test('normalizeRows trims, uppercases SKUs, coerces numbers', () => {
  const [r] = svc.normalizeRows([{
    productName: '  Jack Daniels ', subProductSku: 'jd-01', size: '75cl',
    costPrice: '1200', openingQty: '10', barcode: 'abc123', sizePrice: '',
  }]);
  assert.equal(r.productName, 'Jack Daniels');
  assert.equal(r.subProductSku, 'JD-01');
  assert.equal(r.barcode, 'ABC123');
  assert.equal(r.costPrice, 1200);
  assert.equal(r.openingQty, 10);
  assert.equal(r.sizePrice, null);
  assert.equal(r._rowNum, 1);
});

test('isValidSize checks the Size enum', () => {
  assert.equal(svc.isValidSize('75cl'), true);
  assert.equal(svc.isValidSize('can-330ml'), true);
  assert.equal(svc.isValidSize('banana'), false);
});

test('groupRows groups by subProductSku else name+brand', () => {
  const rows = svc.normalizeRows([
    { productName: 'A', subProductSku: 'S1', size: '75cl' },
    { productName: 'A', subProductSku: 'S1', size: '50cl' },
    { productName: 'B', brand: 'X', size: '1L' },
  ]);
  const groups = svc.groupRows(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2);
});
