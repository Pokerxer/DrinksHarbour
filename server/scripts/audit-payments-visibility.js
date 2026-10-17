// Read-only diagnosis. Prints tenant/source counts, never credentials or customer PII.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
async function main() {
  await require('../config/db').connectDB();
  const db = mongoose.connection.db;
  const tenants = await db.collection('tenants').find({ name: { $in: ['Wyn City', 'CKK Giftery'] } }, { projection: { name: 1, slug: 1 } }).toArray();
  const reports = [];
  for (const tenant of tenants) {
    const count = (collection, filter = {}) => db.collection(collection).countDocuments({ tenant: tenant._id, ...filter });
    const counts = await Promise.all([
      count('customerpayments'), count('vendorpayments'), count('salesorders', { amountPaid: { $gt: 0 } }),
      count('orders', { source: 'pos', paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } }),
      count('journalentries', { status: 'posted', entryType: 'customer_payment' }), count('customerinvoices', { amountPaid: { $gt: 0 } }),
    ]);
    const visible = await require('../services/accountingPayment.service').listPayments(tenant._id, 'customer', { limit: 1 });
    reports.push({ visibleCustomerReceipts: visible.total, receiptSummary: visible.paymentSummary, business: tenant.name, slug: tenant.slug, accountingCustomerPayments: counts[0], accountingVendorPayments: counts[1], salesWithPayment: counts[2], paidPOSReceipts: counts[3], paymentJournals: counts[4], paidInvoices: counts[5] });
  }
  console.log(JSON.stringify(reports, null, 2));
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
