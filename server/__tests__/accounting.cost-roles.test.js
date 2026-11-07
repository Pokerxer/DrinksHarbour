'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { profitLossTotals } = require('../services/accounting.report-totals');
const { buildProfitLoss } = require('../services/accounting.helpers');
const accounts = [{ code: '4000', type: 'income', name: 'Sales' }, { code: '7100', type: 'expense', name: 'Ingredients' }, { code: '7200', type: 'expense', name: 'Rent' }, { code: '7500', type: 'asset', name: 'Inventory' }];
const entries = [{ entryType: 'sales_revenue', lines: [{ account: '4000', credit: 5000 }, { account: '7100', debit: 2000 }, { account: '7200', debit: 400 }] }];

test('reviewed custom expense role becomes COGS consistently without changing four-argument legacy classification', () => {
  const legacy = profitLossTotals(entries, {}, null, accounts);
  assert.equal(legacy.cogs.total, 0);
  assert.equal(legacy.expenseTotal, 2400);
  const approved = profitLossTotals(entries, {}, null, accounts, { costAccountCodes: ['7100'] });
  assert.equal(approved.cogs.total, 2000);
  assert.equal(approved.cogs.source, 'journal');
  assert.equal(approved.expenseTotal, 400);
  assert.equal(approved.grossProfit, 3000);
  assert.equal(approved.netProfit, 2600);
  assert.equal(buildProfitLoss(entries, {}, null, accounts, { costAccountCodes: ['7100'] }).grossProfit, 3000);
});

test('custom role cannot relabel an asset or missing Account metadata as COGS', () => {
  const result = profitLossTotals([{ lines: [{ account: '7500', debit: 2000 }, { account: '7999', debit: 3000 }] }], {}, null, accounts, { costAccountCodes: ['7500', '7999'] });
  assert.equal(result.cogs.total, 0);
});
