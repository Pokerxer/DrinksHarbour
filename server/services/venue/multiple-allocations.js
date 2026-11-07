'use strict';
const Receipt = require('../../models/VenuePaymentReceipt'); const Allocation = require('../../models/VenuePaymentAllocation');
const { id } = require('./eligibility'); const { fail } = require('./errors'); const { balanceFor } = require('./payer-balances');
function allocationComponents(snapshot,amountMinor,allocatedMinor){
  return require('./refund-components').refundComponents({appliedMinor:snapshot.totalMinor,taxMinor:snapshot.taxMinor,financialMinor:require('./money-rules').sum(...(snapshot.financialLines||[]).map(l=>l.amountMinor))},amountMinor,allocatedMinor);
}
async function applyReceipt({ tenantId, receiptId, bill, mongoSession }) {
  const receipt = await Receipt.findOne({ _id: receiptId, tenant: tenantId, collectionVersion: 2, billOrder: bill._id, session: bill.venueServiceSession }).session(mongoSession);
  if (!receipt || receipt.currency !== 'NGN') fail('PAYMENT_REVIEW_REQUIRED', 'Verified receipt does not belong to this bill');
  await require('../../models/Order').updateOne({ _id: bill._id, tenant: tenantId }, { $inc: { venueMoneyLockVersion: 1 } }, { session: mongoSession });
  if (receipt.state === 'applied') return { receipt, ...(await balanceFor(bill, mongoSession)) };
  const Portion = require('../../models/VenuePayerPortion');
  const portion = await Portion.findOne({ tenant: tenantId, billOrder: bill._id, attempt: receipt.attempt }).session(mongoSession);
  if (portion) { portion.state = 'applied'; portion.receipt = receipt._id; await portion.save({ session: mongoSession }); }
  const before = await balanceFor(bill, mongoSession);
  const available = receipt.purpose === 'venue_deposit' ? before.availableMinor : before.outstandingMinor;
  const amountMinor = Math.min(Math.max(0,receipt.amountMinor - receipt.refundedMinor - receipt.refundReservedMinor), Math.max(0, available));
  if (amountMinor > 0) {
    const snapshot = bill.venueBillSnapshot;
    const fee = value => Number(BigInt(value) * BigInt(snapshot.commissionMinor) / BigInt(snapshot.totalMinor));
    const {financialMinor,taxMinor}=allocationComponents(snapshot,amountMinor,before.allocatedMinor);
    const commissionMinor = fee(before.allocatedMinor + amountMinor) - fee(before.allocatedMinor);
    await Allocation.create([{ tenant: tenantId, location: receipt.location, session: receipt.session, billOrder: bill._id, receipt: receipt._id, amountMinor, collectionVersion: 2,
      kind: receipt.purpose === 'venue_deposit' ? 'advance' : 'bill', currency: 'NGN', financialMinor, taxMinor, commissionMinor, tenantMinor: amountMinor - commissionMinor,
      key: `v2:${id(receipt)}`, appliedAt: new Date(), termsVersion: snapshot.termsVersion, rateBps: snapshot.rateBps }], { session: mongoSession });
  }
  receipt.appliedMinor = amountMinor; receipt.unappliedMinor = receipt.amountMinor - receipt.refundedMinor - amountMinor; receipt.state = 'applied';
  if (receipt.unappliedMinor > 0) {
    receipt.resolution = 'excess_credit';
    await require('./collections').enqueue({ tenant: tenantId, location: receipt.location, kind: 'money_resolution', targetId: receipt._id, mongoSession });
  }
  await receipt.save({ session: mongoSession });
  bill.venueAppliedMinor = before.allocatedMinor + amountMinor;
  await bill.save({ session: mongoSession });
  return { receipt, ...(await balanceFor(bill, mongoSession)) };
}
async function v2Postings(bill, mongoSession, date = new Date()) {
  const allocations = await Allocation.find({ tenant: bill.tenant, billOrder: bill._id, collectionVersion: 2 }).session(mongoSession).lean();
  const receipts = await Receipt.find({ tenant: bill.tenant, _id: { $in: allocations.map(a => a.receipt) } }).session(mongoSession).lean();
  const s = bill.venueBillSnapshot, lines = [];
  const tenant=await require('../../models/Tenant').findOne({_id:bill.tenant}).session(mongoSession).lean();
  if(!tenant)fail('NOT_FOUND','Tenant not found',404);
  if(tenant.venueSettings?.accountingClosedThrough&&new Date(date)<=new Date(tenant.venueSettings.accountingClosedThrough))fail('ACCOUNTING_PERIOD_CLOSED','Accounting period is closed; reconciliation required');
  const cost=s.costMode==='actual'?0:require('./money-rules').sum(...s.acceptedLines.map(l=>require('./money-rules').minor(l.costMinor*l.quantity)));
  const codes=new Set(['4000',...(cost?['5000','1200']:[]),...(s.taxMinor?['2100']:[]),...(s.commissionMinor?['6000',bill.venueFinancialPolicy.accounts.clearing]:[]),...(s.financialLines||[]).map(l=>l.account)]);
  for(const receipt of receipts){const policy=require('./financial-policy').validatePolicy(receipt.policySnapshot);codes.add(policy.accounts.advance);codes.add(receipt.provider==='cash'?'1000':policy.accounts.clearing);}
  const accounts=await require('../../models/Account').find({tenant:bill.tenant,code:{$in:[...codes]},isActive:true}).session(mongoSession).lean();
  if(accounts.length!==codes.size)fail('ACCOUNTING_REVIEW_REQUIRED','Required venue accounts are missing or inactive');
  for (const allocation of allocations) {
    const receipt = receipts.find(r => id(r) === id(allocation.receipt));
    if (!receipt) fail('PAYMENT_REVIEW_REQUIRED');
    const policy = require('./financial-policy').validatePolicy(receipt.policySnapshot);
    // Recovery posts advances promptly; final settlement also ensures that the
    // receipt journal exists once before clearing its liability.
    const posted=await require('../../models/JournalEntry').exists({tenant:bill.tenant,refDoc:receipt._id,refDocType:'VenuePaymentReceipt',entryType:'customer_payment'}).session(mongoSession);
    if(!posted&&tenant.venueSettings?.accountingClosedThrough&&new Date(receipt.paidAt||receipt.verifiedAt)<=new Date(tenant.venueSettings.accountingClosedThrough))fail('ACCOUNTING_PERIOD_CLOSED');
    await require('../journalEntry.service').postJournalEntry({ tenantId: bill.tenant, refDoc: receipt._id, refDocType: 'VenuePaymentReceipt', entryType: 'customer_payment', source: 'venue_advance', date: receipt.paidAt || receipt.verifiedAt,
      lines: [{ account: receipt.provider === 'cash' ? '1000' : policy.accounts.clearing, debit: receipt.amountMinor / 100, credit: 0 }, { account: policy.accounts.advance, debit: 0, credit: receipt.amountMinor / 100 }], session: mongoSession });
    lines.push({ account: policy.accounts.advance, debit: allocation.amountMinor / 100, credit: 0 });
  }
  if (s.commissionMinor) lines.push({ account: '6000', debit: s.commissionMinor / 100, credit: 0 }, { account: bill.venueFinancialPolicy.accounts.clearing, debit: 0, credit: s.commissionMinor / 100 });
  lines.push({ account: '4000', debit: 0, credit: s.netMinor / 100 });
  for (const financial of s.financialLines || []) lines.push({account:financial.account,debit:0,credit:financial.amountMinor/100});
  if (s.taxMinor) lines.push({ account: '2100', debit: 0, credit: s.taxMinor / 100 });
  return [{ entryType: 'sales_revenue', lines }, ...(cost ? [{ entryType: 'cogs', lines: [{ account: '5000', debit: cost / 100, credit: 0 }, { account: '1200', debit: 0, credit: cost / 100 }] }] : [])];
}
module.exports = { allocationComponents, applyReceipt, v2Postings };
