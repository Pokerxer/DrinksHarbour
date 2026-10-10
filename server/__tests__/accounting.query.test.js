const test = require('node:test');
const assert = require('node:assert/strict');
const { dateRange, openFilter, normalizeOpenDoc, summarizeOpenDocs , previousWindow } = require('../services/accounting.query');
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

// ── previousWindow: the comparison a P&L is read against ────────────────────

test('previousWindow is the equally long window immediately before', () => {
  // "How did this month do?" is only answerable against a real comparison
  // period. Shifting by a calendar month instead would compare 31 days to 28.
  const w = previousWindow('2026-08-01', '2026-08-31');
  assert.equal(w.from.toISOString(), '2026-07-01T00:00:00.000Z');
  assert.equal(w.to.toISOString(), '2026-07-31T23:59:59.999Z');
  assert.equal(w.fromISO, '2026-07-01T00:00:00.000Z');
  assert.equal(w.toISO, '2026-07-31T23:59:59.999Z');
});

test('previousWindow keeps the span, not the calendar month', () => {
  const a = previousWindow('2026-08-01', '2026-08-15');
  const b = previousWindow('2026-07-17', '2026-07-31');
  assert.equal(
    a.to.getTime() - a.from.getTime(),
    b.to.getTime() - b.from.getTime()
  );
  assert.equal(b.from.toISOString(), '2026-07-02T00:00:00.000Z');
});

test('previousWindow returns null for an open-ended window', () => {
  // "All time" has no preceding period, and inventing one (e.g. all time before
  // the epoch) would put a fabricated figure next to the real one.
  assert.equal(previousWindow(undefined, undefined), null);
  assert.equal(previousWindow('2026-08-01', undefined), null);
  assert.equal(previousWindow(undefined, '2026-08-31'), null);
  assert.equal(previousWindow('', ''), null);
});

test('previousWindow rejects a reversed window rather than returning a future range', () => {
  assert.throws(() => previousWindow('2026-08-31', '2026-08-01'), /before/);
});
