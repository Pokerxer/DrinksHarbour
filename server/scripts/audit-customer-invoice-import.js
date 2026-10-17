// Read-only candidate inventory. Prints tenant labels/counts, never credentials.
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
async function main() {
  await require('../config/db').connectDB();
  const Tenant = require('../models/Tenant');
  const Sales = require('../models/SalesOrder');
  const Order = require('../models/Order');
  const [sales, pos] = await Promise.all([
    Sales.aggregate([{ $match: { $or: [{ invoiceIssuedAt: { $ne: null } }, { invoiceDraft: true },
      { docType: 'order', orderStatus: 'fulfilled' }, { docType: 'order', paymentStatus: 'paid' }] } }, { $group: { _id: '$tenant', count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { source: 'pos', status: { $ne: 'hold' }, $or: [{ paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } }, { status: 'delivered' }] } }, { $group: { _id: '$tenant', count: { $sum: 1 } } }]),
  ]);
  const ids = [...new Set([...sales, ...pos].map(r => String(r._id)).filter(id => mongoose.isValidObjectId(id)))];
  const tenants = await Tenant.find({ _id: { $in: ids } }).select('name slug').lean();
  const report = [];
  for (const t of tenants) {
    const [ledger] = await require('../models/JournalEntry').aggregate([
      { $match: { tenant: t._id } }, { $project: { debit: { $sum: '$lines.debit' }, credit: { $sum: '$lines.credit' } } },
      { $group: { _id: null, count: { $sum: 1 }, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
    ]);
    const invoices = await require('../models/CustomerInvoice').aggregate([{ $match: { tenant: t._id } }, { $group: { _id: '$state', count: { $sum: 1 } } }]);
    report.push({ id: String(t._id), name: t.name, slug: t.slug,
      sales: sales.find(r => String(r._id) === String(t._id))?.count || 0,
      pos: pos.find(r => String(r._id) === String(t._id))?.count || 0,
      ledger: ledger || { count: 0, debit: 0, credit: 0 }, invoices });
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch(err => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
