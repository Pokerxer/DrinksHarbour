// One-off, tenant-scoped repair. Dry-run by default; --apply persists evidence only.
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { projectPOSReturns } = require('../services/linkedReturns.service');
const oid = value => new mongoose.Types.ObjectId(value);
const tenant = oid('699165839f3308b1baeca8fc');
const orderId = oid('6aba04c59b6015e3034ed102');
const salesId = oid('6ab5ec8199cb791195ca8ae9');
const sessionId = oid('6aa871217d5558f9ff4ac428');
const repairKey = 'SO00008-sales-return-20260928-v1';
const sameId = (a, b) => String(a || '') === String(b || '');

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const filter = { _id: orderId, tenant, source: 'pos', linkedSalesOrder: salesId,
    receiptNumber: 'RCP-20260928-0001', posSessionId: sessionId };
  const [order, sales, session, movements] = await Promise.all([
    db.collection('orders').findOne(filter),
    db.collection('salesorders').findOne({ _id: salesId, tenant, soNumber: 'SO00008' }),
    db.collection('possessions').findOne({ _id: sessionId, tenant }),
    db.collection('inventorymovements').find({ tenant, reference: 'SO00008', referenceType: 'return', type: 'return' }).sort({createdAt:1}).toArray(),
  ]);
  assert(order && sales && session, 'Exact tenant/order/session links must exist');
  assert.equal(order.isVoided, false, 'Receipt must not be voided');
  assert.equal(order.items.length, 3);
  assert.equal(movements.length, 3, 'Expected original three stock-return movements');
  const items = order.items.map((item, index) => {
    const lines = sales.items.filter(line => sameId(line.subproduct, item.subproduct) && sameId(line.size, item.size));
    const matches = movements.filter(m => sameId(m.subProduct, item.subproduct) && sameId(m.size, item.size));
    assert.equal(lines.length, 1); assert.equal(matches.length, 1);
    assert.equal(lines[0].returnedQty, [60,60,18][index]);
    assert.equal(matches[0].quantity, lines[0].returnedQty);
    assert.equal(item.quantity, lines[0].returnedQty);
    return { orderItemIndex:index, quantity:matches[0].quantity, movement:matches[0]._id,
      warehouse:matches[0].warehouse, returnedAt:matches[0].createdAt, returnedBy:matches[0].performedBy };
  });
  const existing = (order.salesReturns || []).find(row => row.repairKey === repairKey);
  if (existing) {
    assert.deepEqual(existing.items, items, 'Existing repair must match original evidence');
  } else {
    assert.equal((order.salesReturns || []).length, 0, 'Unexpected existing stock returns');
    assert.equal((order.refunds || []).length, 0, 'Review new cash refunds before repairing');
  }
  const record = { repairKey, salesOrder:salesId, reference:'SO00008', recordedAt:new Date(),
    returnedAt:movements[movements.length - 1].createdAt, items };
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'dry-run',alreadyApplied:!!existing,
    receipt:order.receiptNumber,session:String(sessionId),units:items.map(i=>i.quantity),cashRefund:0},null,2));
  if (!process.argv.includes('--apply')) return;
  if (!existing) {
    const backupPath = `/tmp/${repairKey}-${Date.now()}.json`;
    fs.writeFileSync(backupPath, JSON.stringify({filter, salesReturns:order.salesReturns || [],
      hadSalesReturns:Object.hasOwn(order,'salesReturns'), updatedAt:order.updatedAt},null,2),{mode:0o600,flag:'wx'});
    // Only this receipt changes. No stock, Sales counters, refunds or session cash writes.
    const result = await db.collection('orders').updateOne({ ...filter, updatedAt:order.updatedAt,
      refunds:order.refunds, 'salesReturns.repairKey':{$ne:repairKey},
      $or:[{salesReturns:{$exists:false}},{salesReturns:{$size:0}}] },
      {$push:{salesReturns:record},$set:{updatedAt:new Date()}});
    assert.equal(result.modifiedCount,1,'Receipt changed concurrently; no repair applied');
    console.log('Backup:',backupPath);
  }
  const after = await db.collection('orders').findOne(filter);
  assert.equal(after.salesReturns.filter(row=>row.repairKey===repairKey).length,1);
  assert.deepEqual(after.salesReturns.find(row=>row.repairKey===repairKey).items,items);
  const untouched = value => { const copy={...value};delete copy.salesReturns;delete copy.updatedAt;return copy; };
  assert.deepEqual(untouched(after),untouched(order),'All other receipt fields must be unchanged');
  assert.deepEqual(await db.collection('possessions').findOne({_id:sessionId,tenant}),session,'Session totals must be unchanged');
  assert.deepEqual(await db.collection('salesorders').findOne({_id:salesId,tenant}),sales,'Sales order must be unchanged');
  const [view] = await projectPOSReturns([after],tenant);
  const stockRows = view.refunds.filter(row=>row.source==='sales');
  assert.equal(stockRows.length,1);
  assert.equal(stockRows[0].items.reduce((n,i)=>n+i.quantity,0),138);
  assert.equal(stockRows[0].totalRefunded,0);
  console.log('Verified: one persisted stock return, 138 units, one POS history row; no cash or stock mutation.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
