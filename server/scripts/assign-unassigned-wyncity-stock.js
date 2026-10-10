/** Assign only the 19 audited products, without moving or creating stock units.
 * Dry run: node -r dotenv/config scripts/assign-unassigned-wyncity-stock.js
 * Apply: append --apply. Uses a transaction and per-product AuditLog records.
 */
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');
const manifest = path.resolve(__dirname, '../../docs/reports/unassigned-warehouse-products-2026-10-04.md');
const wanted = fs.readFileSync(manifest, 'utf8').split('\n')
  .filter(line => line.startsWith('| ') && line.includes('WYN48B-'))
  .map(line => { const cells = line.split('|').map(s => s.trim()); return { name: cells[1], size: cells[2], sku: cells[3] }; });
const key = value => value ? String(value) : '';
const apply = process.argv.includes('--apply');
async function main() {
  if (wanted.length !== 19 || new Set(wanted.map(p => p.sku)).size !== 19) throw new Error('Audit manifest must contain exactly 19 unique products');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let output;
  try {
    await session.withTransaction(async () => {
      const options = { session };
      const tenant = await db.collection('tenants').findOne({ slug: 'wyncity' }, options);
      if (!tenant) throw new Error('Wyn City tenant missing');
      const warehouses = await db.collection('warehouses').find({ tenant: tenant._id, name: /^Wyn City$/i, isActive: { $ne: false } }, options).toArray();
      if (warehouses.length !== 1) throw new Error('Expected exactly one active Wyn City warehouse');
      const warehouse = warehouses[0];
      const scope = { tenant: tenant._id };
      const products = await db.collection('subproducts').find({ ...scope, sku: { $in: wanted.map(p => p.sku) } }, options).toArray();
      if (products.length !== 19) throw new Error('Audited product set changed');
      const sizes = await db.collection('sizes').find({ ...scope, _id: { $in: products.flatMap(p => p.sizes || []) } }, options).toArray();
      const stock = await db.collection('warehousestocks').find(scope, options).toArray();
      const rows = [];
      const insertedStockIds = [];
      for (const item of wanted) {
        const product = products.find(p => p.sku === item.sku);
        if (product.warehouse && key(product.warehouse) !== key(warehouse._id)) throw new Error('Product warehouse changed since audit: ' + item.name);
        const variants = sizes.filter(s => (product.sizes || []).some(id => key(id) === key(s._id)));
        const variant = item.size === 'No size' ? null : variants.find(s => s.size === item.size);
        if (item.size === 'No size' && variants.length) throw new Error('Product now has sizes: ' + item.name);
        if (item.size !== 'No size' && (!variant || key(variant.subproduct) !== key(product._id))) throw new Error('Audited size does not belong to product: ' + item.name);
        const existing = variant ? stock.filter(r => key(r.subProduct) === key(product._id) && key(r.size) === key(variant._id)) : [];
        if (existing.some(r => key(r.warehouse) !== key(warehouse._id))) throw new Error('Previously unassigned size is now assigned elsewhere: ' + item.name);
        const newStockId = variant && !existing.length ? new mongoose.Types.ObjectId() : null;
        const before = { warehouse: product.warehouse || null, stockRowIds: existing.map(r => r._id), quantities: existing.map(r => r.currentQuantity || 0) };
        if (apply) {
          if (newStockId) {
            const now = new Date();
            const inserted = await db.collection('warehousestocks').updateOne({ ...scope, warehouse: warehouse._id, subProduct: product._id, size: variant._id }, {
              $setOnInsert: { _id: newStockId, currentQuantity: 0, reservedQuantity: 0, minStockLevel: 0, createdAt: now, updatedAt: now, __v: 0 },
            }, { ...options, upsert: true });
            if (inserted.upsertedCount !== 1) throw new Error('Stock assignment changed concurrently');
            insertedStockIds.push(newStockId);
          }
          const changed = key(product.warehouse) !== key(warehouse._id);
          if (changed) {
            const updated = await db.collection('subproducts').updateOne({ ...scope, _id: product._id, warehouse: product.warehouse || null }, { $set: { warehouse: warehouse._id, updatedAt: new Date() } }, options);
            if (updated.matchedCount !== 1) throw new Error('Product assignment changed concurrently');
          }
          if (changed || newStockId) await db.collection('auditlogs').insertOne({
            actorRole: 'system', action: 'SUBPRODUCT_WAREHOUSE_ASSIGN', actionCategory: 'update',
            targetType: 'SubProduct', targetId: product._id, targetTenantId: tenant._id,
            justification: 'Explicit user request: assign audited unassigned products to Wyn City warehouse; preserve quantities.',
            changes: { before, after: { warehouse: warehouse._id, createdStockRowId: newStockId, size: variant?._id || null, createdQuantity: newStockId ? 0 : null } },
            result: 'success', timestamp: new Date(),
          }, options);
        }
        rows.push({ name: item.name, sku: item.sku, size: item.size, productId: key(product._id), beforeWarehouse: key(product.warehouse), warehouse: warehouse.name, createdStockRowId: key(newStockId) || null });
      }
      if (apply) {
        const after = await db.collection('warehousestocks').find(scope, options).toArray();
        const original = new Map(stock.map(r => [key(r._id), r]));
        for (const row of after) {
          const prev = original.get(key(row._id));
          if (prev && (row.currentQuantity !== prev.currentQuantity || row.reservedQuantity !== prev.reservedQuantity)) throw new Error('Stock quantity changed');
          if (!prev && (!insertedStockIds.some(id => key(id) === key(row._id)) || row.currentQuantity !== 0 || row.reservedQuantity !== 0)) throw new Error('Unexpected stock record');
        }
        if (after.length !== stock.length + insertedStockIds.length) throw new Error('Stock row count changed unexpectedly');
        const verified = await db.collection('subproducts').countDocuments({ ...scope, _id: { $in: products.map(p => p._id) }, warehouse: warehouse._id }, options);
        if (verified !== 19) throw new Error('Warehouse assignment verification failed');
      }
      output = { applied: apply, tenant: tenant.name, warehouse: warehouse.name, warehouseId: key(warehouse._id), products: rows.length, zeroStockRows: rows.filter(r => r.createdStockRowId).length, noSizeProducts: rows.filter(r => r.size === 'No size').map(r => r.name), existingQuantitiesPreserved: true, rows };
    });
    if (apply) fs.writeFileSync('/tmp/wyncity-warehouse-assignment-result.json', JSON.stringify(output, null, 2));
    console.log(JSON.stringify(output, null, 2));
  } finally { await session.endSession(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
