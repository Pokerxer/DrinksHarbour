// Read-only review. Never creates bills/payments, touches inventory, or posts journals.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const round = (n) => Math.round(n * 100) / 100;
async function main() {
  await require('../config/db').connectDB();
  const db = mongoose.connection.db;
  const tenants = await db.collection('tenants').find({ name: { $in: ['Wyn City', 'CKK Giftery'] } }, { projection: { name: 1 } }).toArray();
  const report = [];
  for (const tenant of tenants) {
    const orders = await db.collection('purchaseorders').find({ tenant: tenant._id, status: 'validated' }, { projection: { poNumber: 1, vendor: 1, vendorName: 1, currency: 1, orderDate: 1, billControlPolicy: 1, 'items.quantity': 1, 'items.receivedQty': 1, 'items.returnedQty': 1, 'items.unitCost': 1, 'items.taxRate': 1 } }).sort({ orderDate: 1, _id: 1 }).toArray();
    const rows = [];
    for (const order of orders) {
      const vendor = order.vendor ? await db.collection('vendors').findOne({ _id: order.vendor, tenant: tenant._id }, { projection: { _id: 1 } }) : null;
      rows.push({ id: String(order._id), number: order.poNumber, vendor: order.vendorName, vendorAvailable: !!vendor, currency: order.currency || 'NGN', orderDate: order.orderDate,
        receivedBillAmount: round((order.items || []).reduce((n, item) => n + (item.receivedQty || 0) * (item.unitCost || 0) * (1 + (item.taxRate || 0) / 100), 0)),
        returnedUnits: (order.items || []).reduce((n, item) => n + (item.returnedQty || 0), 0),
        existingBills: await db.collection('vendorbills').countDocuments({ tenant: tenant._id, purchaseOrder: order._id, status: { $ne: 'cancelled' } }),
      });
    }
    report.push({ business: tenant.name, orders: rows });
  }
  console.log(JSON.stringify(report, null, 2));
}
main().catch((err) => { console.error(err.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
