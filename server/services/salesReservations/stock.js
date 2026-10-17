const Stock = require('../../models/WarehouseStock');
const Batch = require('../../models/WarehouseBatch');
const Size = require('../../models/Size');
const Tenant = require('../../models/Tenant');
const { recalcSubProductStock } = require('../warehouseStock.helpers');
const { freeStock } = require('./quantities');
async function expiryState(key, session) {
  const tenant = await Tenant.findOne({_id:key.tenant}).select('warehouseSettings.blockExpiredStock').session(session).lean();
  if (!tenant?.warehouseSettings?.blockExpiredStock) return {expired:0,quarantinedExpired:0};
  const batches = await Batch.find({...key,quantity:{$gt:0},expiryDate:{$ne:null,$lte:new Date()}})
    .select('quantity quarantined').session(session).lean();
  return batches.reduce((sum,b) => ({expired:sum.expired+b.quantity,
    quarantinedExpired:sum.quarantinedExpired+(b.quarantined ? b.quantity : 0)}),{expired:0,quarantinedExpired:0});
}
async function availableStock(key, session) {
  const row = await Stock.findOne(key).session(session).lean();
  return {row, available:freeStock({onHand:row?.currentQuantity || 0,
    reserved:row?.reservedQuantity || 0,...await expiryState(key,session)})};
}
async function rollup(key, session) {
  await recalcSubProductStock(key.subProduct,session,key.tenant);
  const rows = await Stock.find({tenant:key.tenant,subProduct:key.subProduct,size:key.size})
    .select('currentQuantity reservedQuantity').session(session).lean();
  const stock = rows.reduce((s,r)=>s+r.currentQuantity,0);
  const reservedStock = rows.reduce((s,r)=>s+(r.reservedQuantity||0),0);
  await Size.updateOne({_id:key.size,tenant:key.tenant,subproduct:key.subProduct},
    {$set:{stock,reservedStock,availableStock:Math.max(0,stock-reservedStock)}},{session});
}
module.exports = { availableStock, rollup, expiryState };
