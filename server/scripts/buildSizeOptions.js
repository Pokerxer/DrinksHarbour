// scripts/buildSizeOptions.js
//
// Build the size-variant universe for the multi-size seeder flag.
//
// Cloud Bay's PDF priced each SKU at ONE drum/size, so the match file holds a
// single size per product. But the catalog carries 2–4 size variants on 17 of
// those subProducts (1023 sizes / 1002 subproducts). This script walks every
// matched row's subProduct, lists its sellable sizes, and writes
// seed-output/size-options.json — a map the seeder's --multi-size flag uses to
// rotate a product across its actual sizes.
//
// Output envelope:
//   {
//     version: 1,
//     refreshedAt: ISO,
//     stats: { matched, withVariants, sellableSizes, checkedSizes, unmatched },
//     changed: ["<label>: <checked> → <sibling> (n units, avail)"],
//     products: { "<productId>": { checkedSize: "<sizeId>", variants: [...] } },
//     unmatched: [{ productId, productName, subProductId, reason }]
//   }
//
// Each variant is shaped like a match-file row so the seeder can spread it
// directly onto a line: it carries productId/productType/productSubType for
// review copy, subProductId/sizeId/sizeName for the cart payload, and
// sellingPrice → price, minOrderQuantity → min, maxOrderQuantity → max.
//
// Usage:
//   node -r dotenv/config scripts/buildSizeOptions.js [--out path]

'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const flagsLib = require('./lib/flags');

const OUT = path.resolve(__dirname, 'seed-output', 'size-options.json');
// Same sellable set the seeder uses for match rows, including legacy in_stock.
const SELLABLE = new Set(['available', 'low_stock', 'in_stock']);

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const outPath = flagsLib.get(args, 'out') || OUT;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  if (!(uri.includes('_seed') || uri.includes('seed'))) {
    console.error('✋ buildSizeOptions reads variant stock — use the seed database.');
    console.error('   Refusing to guess against a production URI.');
    process.exit(1);
  }
  const conn = await mongoose.createConnection(uri).asPromise();

  const matchFile = path.resolve(__dirname, 'seed-output', 'cloudbay-product-match.json');
  const { final: rows } = JSON.parse(fs.readFileSync(matchFile, 'utf8'));

  const subProductIds = [...new Set(rows.map((r) => r.subProductId))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const sps = await conn.db.collection('subproducts')
    .find({ _id: { $in: subProductIds } })
    .project({ product: 1, sizes: 1, tenant: 1 })
    .toArray();
  const spMap = new Map(sps.map((s) => [String(s._id), s]));

  const allSizeIds = [...new Set(sps.flatMap((s) => (s.sizes || []).map(String)))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const sizes = await conn.db.collection('sizes')
    .find({ _id: { $in: allSizeIds } })
    .project({
      size: 1, displayName: 1, sellingPrice: 1, compareAtPrice: 1,
      stock: 1, availability: 1, minOrderQuantity: 1, maxOrderQuantity: 1,
      subproduct: 1,
    })
    .toArray();
  const sizesBySp = new Map();
  for (const z of sizes) {
    const k = String(z.subproduct);
    if (!sizesBySp.has(k)) sizesBySp.set(k, []);
    sizesBySp.get(k).push(z);
  }

  const products = {};
  const changed = [];
  const unmatched = [];
  let sellableSizes = 0;

  for (const r of rows) {
    const sp = spMap.get(String(r.subProductId));
    const list = (sizesBySp.get(String(r.subProductId)) || [])
      .filter((z) =>
        Number(z.stock) > 0 && SELLABLE.has(String(z.availability).toLowerCase()));

    if (list.length === 0) {
      unmatched.push({
        productId: r.productId, productName: r.productName,
        subProductId: r.subProductId,
        reason: sp?.sizes?.length ? 'no sellable size in stock' : 'no sizes on subproduct',
      });
      continue;
    }

    const totalStock = list.reduce((s, z) => s + Number(z.stock || 0), 0);
    const variants = list.map((z) => {
      sellableSizes += 1;
      const stock = Number(z.stock) || 0;
      // Traceability: PDF soldQty distributed across the sizes in proportion
      // to each variant's stock share; the checked size keeps its own number.
      const isChecked = String(z._id) === String(r.sizeId);
      const checkedSoldQty = isChecked
        ? (Number(r.soldQty) || 0)
        : Math.max(1, Math.round((Number(r.soldQty) || 0) * (stock / totalStock)));
      return {
        productId: r.productId,
        productName: r.productName,
        productType: r.productType,
        productSubType: r.productSubType ?? null,
        isAlcoholic: r.isAlcoholic,
        subProductId: r.subProductId,
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        sizeId: String(z._id),
        sizeName: z.size || z.displayName || 'unknown',
        price: Number(z.sellingPrice) || 0,
        compareAtPrice: Number(z.compareAtPrice) || null,
        stock,
        availability: String(z.availability),
        min: Number(z.minOrderQuantity) || 1,
        max: z.maxOrderQuantity == null ? null : Number(z.maxOrderQuantity),
        checkedSoldQty,
        isChecked,
      };
    });

    const before = products[String(r.productId)];
    if (before) throw new Error(`multi-size: duplicate productId ${r.productId}`);
    products[String(r.productId)] = {
      checkedSize: String(r.sizeId),
      variants,
    };

    const siblings = variants.filter((v) => !v.isChecked);
    for (const sib of siblings) {
      changed.push(
        `${r.productName}: ${r.sizeName} → ${sib.sizeName} ` +
        `(${sib.stock} units, ${sib.availability})`,
      );
    }
  }

  const output = {
    version: 1,
    refreshedAt: new Date().toISOString(),
    stats: {
      matchedRows: rows.length,
      productsWithVariants: Object.keys(products).filter(
        (k) => products[k].variants.length > 1,
      ).length,
      sellableSizes,
      checkedSizes: rows.length,
      unmatched: unmatched.length,
    },
    changed,
    products,
    unmatched,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 1));
  console.log(`✓ wrote ${outPath}`);
  console.log(`  matched rows              : ${rows.length}`);
  console.log(`  products w/ multiple sizes: ${output.stats.productsWithVariants}`);
  console.log(`  sellable sizes            : ${output.stats.sellableSizes}`);
  console.log(`  size swaps available      : ${changed.length}`);
  console.log(`  unmatched (no sellable)   : ${unmatched.length}`);
  for (const c of changed.slice(0, 8)) console.log(`    ${c}`);
  if (changed.length > 8) console.log(`    … +${changed.length - 8} more`);

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});