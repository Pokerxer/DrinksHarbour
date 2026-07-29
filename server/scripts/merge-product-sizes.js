'use strict';

// Merge a duplicate product's size variants into the product that should survive.
//
// Catalog imports occasionally create the same drink twice under slightly
// different names ("Riunite Moscato White" vs "Riunite Moscato White Wine"),
// each holding one size of what is really one product. This moves every Size
// from the duplicate's sub-product onto the survivor's sub-product, repoints the
// inventory ledgers that reference them, recalculates both rollups and archives
// the now-empty duplicate.
//
// Stock is never created or destroyed — the Size docs (and their WarehouseStock
// rows) are moved as-is, so quantities and the movement history survive intact.
//
// Refuses to run when the duplicate is referenced by a cart, order or sales
// order: those need a considered migration, not a bulk repoint.
//
// Usage:
//   FROM_SLUG=riunite-moscato-white-1785251668562 \
//   TO_SLUG=riunite-moscato-white-wine \
//   node scripts/merge-product-sizes.js              # dry run (default)
//
//   ... DRY_RUN=false node scripts/merge-product-sizes.js   # apply

const mongoose = require('mongoose');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://jrwaldehzx:NWXdpyCMP7yB7a4N@cluster0.ukrr40p.mongodb.net/drinksharbour';

const FROM_SLUG = process.env.FROM_SLUG;
const TO_SLUG = process.env.TO_SLUG;
const DRY_RUN = String(process.env.DRY_RUN || 'true').toLowerCase() !== 'false';

// Collections that would make a silent repoint unsafe — a live customer or
// order is pointing at the duplicate.
const BLOCKING_COLLECTIONS = ['carts', 'wishlists', 'orders', 'salesorders', 'sales', 'poscombos'];
// Inventory ledgers that reference (subProduct, size) and must follow the move.
const LEDGER_COLLECTIONS = ['warehousestocks', 'inventorymovements', 'warehousemovements', 'warehousebatches', 'reorderrules', 'stocktransfers'];

async function loadProduct(db, slug, label) {
  const product = await db.collection('products').findOne({ slug });
  if (!product) throw new Error(`${label} product not found for slug "${slug}"`);
  const subs = await db.collection('subproducts').find({ product: product._id }).toArray();
  if (subs.length !== 1) {
    throw new Error(`${label} "${product.name}" has ${subs.length} sub-products; this script only handles exactly 1`);
  }
  const sizes = await db.collection('sizes').find({ subproduct: subs[0]._id }).toArray();
  return { product, sub: subs[0], sizes };
}

function describe({ product, sub, sizes }) {
  const list = sizes.map((s) => `${s.size} × ${s.stock} @₦${s.sellingPrice}`).join(', ') || 'no sizes';
  return `"${product.name}" [${product.status}${product.isPublished ? ', published' : ''}] sub ${sub.sku} — ${list}`;
}

async function main() {
  if (!FROM_SLUG || !TO_SLUG) throw new Error('FROM_SLUG and TO_SLUG are required');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  const from = await loadProduct(db, FROM_SLUG, 'Duplicate');
  const to = await loadProduct(db, TO_SLUG, 'Surviving');

  console.log(`Duplicate : ${describe(from)}`);
  console.log(`Survivor  : ${describe(to)}`);

  if (String(from.product._id) === String(to.product._id)) throw new Error('FROM and TO are the same product');
  if (String(from.sub.tenant) !== String(to.sub.tenant)) throw new Error('Refusing to merge across tenants');
  if (from.sizes.length === 0) throw new Error('Duplicate has no sizes to move');

  // A size the survivor already carries would collide — the operator has to
  // decide which price/stock wins, so stop rather than guess.
  const survivorSizes = new Set(to.sizes.map((s) => s.size));
  const clashes = from.sizes.filter((s) => survivorSizes.has(s.size));
  if (clashes.length) {
    throw new Error(`Survivor already has size(s) ${clashes.map((s) => s.size).join(', ')} — resolve by hand first`);
  }

  for (const coll of BLOCKING_COLLECTIONS) {
    const n = await db.collection(coll).countDocuments({
      $or: [
        { product: from.product._id }, { subProduct: from.sub._id },
        { 'items.product': from.product._id }, { 'items.subProduct': from.sub._id },
        { 'items.productId': from.product._id }, { 'items.subProductId': from.sub._id },
      ],
    });
    if (n) throw new Error(`${n} ${coll} document(s) reference the duplicate — migrate those first`);
  }

  const sizeIds = from.sizes.map((s) => s._id);
  console.log(`\nPlan:`);
  console.log(`  move ${sizeIds.length} size(s) [${from.sizes.map((s) => s.size).join(', ')}] onto sub ${to.sub.sku}`);
  console.log(`  survivor sizes after merge: ${[...to.sizes, ...from.sizes].map((s) => s.size).join(', ')}`);
  console.log(`  survivor stock after merge: ${[...to.sizes, ...from.sizes].reduce((a, s) => a + (s.stock || 0), 0)}`);
  for (const coll of LEDGER_COLLECTIONS) {
    const n = await db.collection(coll).countDocuments({ size: { $in: sizeIds } });
    if (n) console.log(`  repoint ${n} ${coll} row(s) to the surviving sub-product/product`);
  }
  console.log(`  archive duplicate product "${from.product.name}" and its empty sub-product`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing written. Re-run with DRY_RUN=false to apply.');
    await mongoose.disconnect();
    return;
  }

  // 1. Re-parent the Size docs.
  await db.collection('sizes').updateMany(
    { _id: { $in: sizeIds } },
    { $set: { subproduct: to.sub._id } }
  );

  // 2. Fix both sub-products' size arrays.
  await db.collection('subproducts').updateOne(
    { _id: to.sub._id },
    { $addToSet: { sizes: { $each: sizeIds } } }
  );
  await db.collection('subproducts').updateOne(
    { _id: from.sub._id },
    { $pull: { sizes: { $in: sizeIds } } }
  );

  // 3. Ledgers follow the sizes.
  for (const coll of LEDGER_COLLECTIONS) {
    const set = { subProduct: to.sub._id };
    // Only inventorymovements carries a product reference.
    if (coll === 'inventorymovements') set.product = to.product._id;
    const res = await db.collection(coll).updateMany({ size: { $in: sizeIds } }, { $set: set });
    if (res.matchedCount) console.log(`  repointed ${res.modifiedCount}/${res.matchedCount} ${coll}`);
  }

  // 4. Recalculate both rollups from the sizes that now belong to each.
  const { recalcSubProductStock } = require('../services/warehouseStock.helpers');
  for (const subId of [to.sub._id, from.sub._id]) {
    try {
      await recalcSubProductStock(subId);
    } catch (err) {
      // Fall back to summing Size.stock when the warehouse rollup is unavailable.
      const rows = await db.collection('sizes').find({ subproduct: subId }).project({ stock: 1, reservedStock: 1 }).toArray();
      const total = rows.reduce((a, s) => a + (s.stock || 0), 0);
      const reserved = rows.reduce((a, s) => a + (s.reservedStock || 0), 0);
      await db.collection('subproducts').updateOne(
        { _id: subId },
        { $set: { totalStock: total, reservedStock: reserved, availableStock: Math.max(0, total - reserved) } }
      );
    }
  }

  // 5. Retire the duplicate. Archived rather than deleted so the movement
  //    history keeps a resolvable parent.
  await db.collection('subproducts').updateOne(
    { _id: from.sub._id },
    { $set: { status: 'archived', totalStock: 0, availableStock: 0, reservedStock: 0 } }
  );
  await db.collection('products').updateOne(
    { _id: from.product._id },
    { $set: { status: 'archived', isPublished: false, isFeatured: false } }
  );

  const after = await loadProduct(db, TO_SLUG, 'Surviving');
  console.log(`\nMerged. Survivor is now: ${describe(after)}`);
  console.log(`Duplicate "${from.product.name}" archived.`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error(`\n${err.message}`); process.exit(1); });
