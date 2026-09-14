const test = require('node:test');
const assert = require('node:assert/strict');
const { dateRange, openFilter, normalizeOpenDoc, summarizeOpenDocs } = require('../services/accounting.query');
test('date ranges include the last day and reject invalid/reversed dates', () => {
  assert.equal(dateRange({ to: '2026-09-13' }).$lt.toISOString(), '2026-09-14T00:00:00.000Z');
  assert.throws(() => dateRange({ from: 'bad' }), /date/i);
  assert.throws(() => dateRange({ from: '2026-09-14', to: '2026-09-13' }), /before/i);
});
test('receivables exclude drafts and cancelled orders and use actual date field', () => {
  const filter = openFilter('tenant', 'ar', { from: '2026-09-01' });
  assert.equal(filter.tenant, 'tenant');
  assert.deepEqual(filter.orderStatus.$in, ['confirmed', 'partially_fulfilled', 'fulfilled']);
  assert.ok(filter.createdAt);
  assert.equal(filter.date, undefined);
  assert.throws(() => openFilter('tenant', 'ar', { status: 'paid' }), /status/i);
});
test('bills filter by billDate and normalize sales/bill numbers and dates', () => {
  assert.ok(openFilter('tenant', 'ap', { to: '2026-09-01' }).billDate);
  assert.equal(normalizeOpenDoc({ soNumber: 'SO-1', createdAt: 'date', total: 100, amountPaid: 30 }, 'ar').outstanding, 70);
  assert.equal(normalizeOpenDoc({ soNumber: 'SO-1' }, 'ar').orderNumber, 'SO-1');
  assert.equal(normalizeOpenDoc({ billDate: 'date', totalAmount: 10, paidAmount: 20 }, 'ap').outstanding, 0);
});
test('aging uses due dates and counts only positive balances', () => {
  const result = summarizeOpenDocs([
    { total: 100, amountPaid: 20, dueDate: '2026-10-01', createdAt: '2026-01-01' },
    { total: 100, amountPaid: 100, dueDate: '2026-01-01' },
    { total: 50, dueDate: '2026-08-20' },
  ], 'ar', new Date('2026-09-13'));
  assert.equal(result.count, 2);
  assert.equal(result.totalOutstanding, 130);
  assert.equal(result.buckets.current, 80);
  assert.equal(result.buckets['16-30'], 50);
});
test('applied credits reduce receivables without claiming cash was received', () => {
  const row = normalizeOpenDoc({ total: 100, amountPaid: 20, creditedAmount: 30 }, 'ar');
  assert.equal(row.outstanding, 50);
  assert.equal(row.amountPaid, 20);
});
