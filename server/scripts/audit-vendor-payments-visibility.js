// Read-only evidence: counts/totals only, no credentials, vendor details or writes.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
async function main() {
  await require('../config/db').connectDB();
  const db = mongoose.connection.db;
  const tenants = await db.collection('tenants').find({ name: { $in: ['Wyn City', 'CKK Giftery'] } }, { projection: { name: 1 } }).toArray();
  const reports = [];
  for (const tenant of tenants) {
    const count = (collection, filter = {}) => db.collection(collection).countDocuments({ tenant: tenant._id, ...filter });
    const [payments, bills, journals, orders, visible] = await Promise.all([
      db.collection('vendorpayments').aggregate([{ $match: { tenant: tenant._id } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]).toArray(),
      db.collection('vendorbills').aggregate([{ $match: { tenant: tenant._id } }, { $group: { _id: '$status', count: { $sum: 1 }, paid: { $sum: '$paidAmount' }, histories: { $sum: { $size: { $ifNull: ['$payments', []] } } } } }]).toArray(),
      db.collection('journalentries').aggregate([{ $match: { tenant: tenant._id, $or: [{ entryType: 'vendor_payment' }, { refDocType: { $in: ['VendorBill', 'VendorPayment', 'PurchaseOrder'] } }] } }, { $group: { _id: { type: '$refDocType', entry: '$entryType', status: '$status' }, count: { $sum: 1 } } }]).toArray(),
      db.collection('purchaseorders').aggregate([{ $match: { tenant: tenant._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray(),
      require('../services/accountingPayment.service').listPayments(tenant._id, 'vendor', { limit: 1 }),
    ]);
    reports.push({ business: tenant.name, visiblePayments: visible.total, summary: visible.paymentSummary, payments, bills, journals, orders,
      billsWithUnlinkedPaymentHistory: await count('vendorbills', { payments: { $elemMatch: { reference: { $not: /^accounting:/ } } } }) });
  }
  console.log(JSON.stringify(reports, null, 2));
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
