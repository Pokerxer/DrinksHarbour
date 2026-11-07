'use strict';
const mongoose = require('mongoose');
const { fail } = require('./errors');
async function postAdvance(receiptId, tenantId) {
  const mongoSession = await mongoose.startSession();
  try {
    return await mongoSession.withTransaction(async () => {
      const receipt = await require('../../models/VenuePaymentReceipt').findOne({ _id: receiptId, tenant: tenantId, collectionVersion: 2 }).session(mongoSession);
      if (!receipt) fail('NOT_FOUND', 'Advance receipt not found', 404);
      const policy = require('./financial-policy').validatePolicy(receipt.policySnapshot);
      const tenant = await require('../../models/Tenant').findOne({ _id: tenantId }).session(mongoSession).lean();
      const date = receipt.paidAt || receipt.verifiedAt;
      if (!tenant || tenant.venueSettings?.accountingClosedThrough && new Date(date) <= new Date(tenant.venueSettings.accountingClosedThrough)) fail('ACCOUNTING_PERIOD_CLOSED');
      const amount = receipt.amountMinor / 100;
      return require('../journalEntry.service').postJournalEntry({ tenantId, source: 'venue_advance', refDoc: receipt._id, refDocType: 'VenuePaymentReceipt', entryType: 'customer_payment', date,
        lines: [{ account: receipt.provider==='cash'?'1000':policy.accounts.clearing, debit: amount, credit: 0 }, { account: policy.accounts.advance, debit: 0, credit: amount }], memo: 'Verified venue advance or partial payment', session: mongoSession });
    });
  } finally { await mongoSession.endSession(); }
}
module.exports = { postAdvance };
