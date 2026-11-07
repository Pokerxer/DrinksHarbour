'use strict';
const { fail } = require('./errors');
const line = (account, debit = 0, credit = 0) => ({ account, debit: debit / 100, credit: credit / 100 });
function venuePostings(bill, receipt) {
  const s = bill.venueBillSnapshot;
  const lines = [line(receipt.provider === 'cash' ? '1000' : '1300', s.totalMinor - s.commissionMinor)];
  if (s.commissionMinor) lines.push(line('6000', s.commissionMinor));
  lines.push(line('4000', 0, s.netMinor));
  if (s.taxMinor) lines.push(line('2100', 0, s.taxMinor));
  const postings = [{ entryType: 'sales_revenue', lines }];
  const cost = s.costMode === 'actual' ? 0 : s.acceptedLines.reduce((sum, l) => sum + l.costMinor * l.quantity, 0);
  if (!Number.isSafeInteger(cost) || cost < 0) fail('INVALID_MONEY', 'Invalid cost snapshot');
  if (cost) postings.push({ entryType: 'cogs', lines: [line('5000', cost), line('1200', 0, cost)] });
  return postings;
}
async function preflightVenueAccounting({ tenantId, snapshot, method, mongoSession = null, date = new Date() }) {
  const postings = venuePostings({ venueBillSnapshot: snapshot }, { provider: method });
  const codes = [...new Set(postings.flatMap(p => p.lines.map(l => l.account)))];
  const accounts = await require('../../models/Account').find({ tenant: tenantId, code: { $in: codes }, isActive: true }).session(mongoSession).lean();
  if (accounts.length !== codes.length) fail('ACCOUNTING_REVIEW_REQUIRED', 'Required venue accounts are missing or inactive');
  const tenant = await require('../../models/Tenant').findOne({ _id: tenantId }).select('venueSettings.accountingClosedThrough').session(mongoSession).lean();
  if (!tenant) fail('NOT_FOUND', 'Tenant not found', 404);
  if (tenant.venueSettings?.accountingClosedThrough && new Date(date) <= new Date(tenant.venueSettings.accountingClosedThrough)) fail('ACCOUNTING_PERIOD_CLOSED', 'Accounting period is closed; reconciliation required');
  return postings;
}
async function postVenueAccounting({ bill, receipt, mongoSession }) {
  const date = receipt.paidAt || receipt.verifiedAt;
  const postings = bill.venueMoneyVersion === 2 ? await require('./multiple-allocations').v2Postings(bill, mongoSession, date) : await preflightVenueAccounting({ tenantId: bill.tenant, snapshot: bill.venueBillSnapshot, method: receipt.provider, mongoSession, date });
  for (const posting of postings) await require('../journalEntry.service').postJournalEntry({ ...posting, tenantId: bill.tenant, refDoc: bill._id, refDocType: 'Order', source: 'venue', date, postedBy: bill.posStaff, memo: `Venue bill ${bill.orderNumber}`, session: mongoSession });
  if (bill.venueBillSnapshot.costMode === 'actual') await require('./cost-recognition').recognizeBillCosts({ tenantId: String(bill.tenant), billOrder: bill, mongoSession });
}
module.exports = { venuePostings, preflightVenueAccounting, postVenueAccounting };
