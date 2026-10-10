/**
 * READ-ONLY. Exports a tenant's SubProducts and their selling prices to .xlsx.
 *
 * Selling price lives on the Size documents (SubProduct.sizes is a list of
 * ObjectId refs into the `sizes` collection), not on the SubProduct itself, so
 * the sheet is one row per size. A SubProduct with no sizes still gets a row
 * rather than being dropped, so the row count always reconciles to the
 * SubProduct count on the summary sheet.
 *
 * Prices are stored in naira (major units) — the client renders them straight
 * through Intl.NumberFormat with no /100 scaling, so no conversion is applied
 * here either. Cost price is included because this is the tenant's own
 * catalogue and a price sheet without it is not much use; it is deliberately
 * not a public-facing export.
 *
 * Usage:  node scripts/export-tenant-subproducts-prices-xlsx.js [tenantSlug] [out.xlsx]
 */
require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

const SLUG = process.argv[2] || 'ckay';
const OUT =
  process.argv.find((a) => a.endsWith('.xlsx')) ||
  path.join(__dirname, '..', '..', `CKay SubProducts & Prices - ${new Date().toISOString().slice(0, 10)}.xlsx`);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const money = (v) => {
  const n = num(v);
  return n === null ? null : Math.round(n * 100) / 100;
};
// Margin as the platform defines it: profit as a share of the selling price
// (matches SubProduct.marginPercentage — 30.77% on 6500/4500).
const marginPct = (sell, cost) => {
  if (sell === null || cost === null || sell <= 0) return null;
  return Math.round(((sell - cost) / sell) * 10000) / 100;
};
const nameOf = (ref) => (ref && typeof ref === 'object' ? ref.name : '');

/** Resolve ObjectId refs to `name`, tolerating nulls and pre-populated docs. */
function makeRefResolver(db, collection) {
  return async (refs) => {
    // A raw driver ObjectId has typeof 'object', so it cannot be told apart
    // from a populated document by typeof alone. A populated ref is the only
    // one carrying a name.
    const isPopulated = (r) => r && typeof r === 'object' && typeof r.name === 'string';
    const ids = [...new Set(refs.filter((r) => r && !isPopulated(r)).map(String))];
    if (!ids.length) return new Map();
    const docs = await db
      .collection(collection)
      .find({ _id: { $in: ids.map((b) => new mongoose.Types.ObjectId(b)) } })
      .toArray();
    const map = new Map(docs.map((d) => [String(d._id), d.name || '']));
    for (const r of refs) {
      if (isPopulated(r)) map.set(String(r._id || r), r.name);
    }
    return map;
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 60000,
  });
  const db = mongoose.connection.db;

  const tenant = await db.collection('tenants').findOne({ slug: SLUG });
  if (!tenant) throw new Error(`No tenant with slug "${SLUG}"`);

  const subProducts = await db
    .collection('subproducts')
    .find({ tenant: tenant._id })
    .toArray();

  // Resolve the central Product refs and the Size refs in two batched lookups
  // rather than N+1 per document.
  const productIds = [
    ...new Set(subProducts.map((s) => s.product).filter(Boolean).map(String)),
  ];
  const sizeIds = [
    ...new Set(subProducts.flatMap((s) => (Array.isArray(s.sizes) ? s.sizes : [])).map(String)),
  ];

  const prods = productIds.length
    ? await db
        .collection('products')
        .find({ _id: { $in: productIds.map((b) => new mongoose.Types.ObjectId(b)) } })
        .toArray()
    : [];
  const products = new Map(prods.map((p) => [String(p._id), p]));
  const sizes = new Map(
    sizeIds.length
      ? (await db.collection('sizes').find({ _id: { $in: sizeIds.map((b) => new mongoose.Types.ObjectId(b)) } }).toArray()).map(
          (s) => [String(s._id), s]
        )
      : []
  );

  // brand/category on Product are ObjectId refs, mostly unpopulated, so they
  // have to be resolved or the sheet ships with two blank columns.
  const resolveBrand = makeRefResolver(db, 'brands');
  const resolveCategory = makeRefResolver(db, 'categories');
  const brandNames = await resolveBrand(prods.map((p) => p.brand));
  const categoryNames = await resolveCategory(prods.map((p) => p.category));

  const rows = [];
  let retail = 0;
  let costValue = 0;
  let totalStock = 0;

  for (const sp of subProducts) {
    const product = products.get(String(sp.product)) || {};
    const variants = (Array.isArray(sp.sizes) ? sp.sizes : []).map((id) => sizes.get(String(id))).filter(Boolean);

    // Always at least one row, so a size-less SubProduct is still reported.
    const list = variants.length ? variants : [null];

    for (const size of list) {
      const sell = money(size ? size.sellingPrice : sp.sellingPrice);
      const cost = money(size ? size.costPrice : sp.costPrice);
      const stock = num(size ? size.availableStock ?? size.stock : sp.stockQuantity) ?? 0;
      const m = marginPct(sell, cost);

      if (sell !== null) retail += sell * stock;
      if (cost !== null) costValue += cost * stock;
      totalStock += stock;

      rows.push({
        'Product Name': product.name || '',
        'SKU': sp.sku || '',
        Size: size ? size.displayName || size.sizeCategory || '' : '',
        'Size SKU': (size && size.sku) || '',
        Brand: brandNames.get(String(product.brand)) || nameOf(product.brand) || '',
        Category: categoryNames.get(String(product.category)) || nameOf(product.category) || '',
        Type: product.type || '',
        'ABV %': num(product.abv),
        'Volume (ml)': num(product.volumeMl),
        'Units per Pack': size ? (num(size.unitsPerPack) ?? 1) : 1,
        'Selling Price (NGN)': sell,
        'Cost Price (NGN)': cost,
        'Margin %': m,
        'Stock': stock,
        'Availability': (size && size.availability) || '',
        'Size Status': (size && size.status) || '',
        'Default Size': size ? (size.isDefault ? 'Yes' : '') : '',
        'Product Status': product.status || '',
        'SubProduct Status': sp.status || '',
      });
    }
  }

  rows.sort((a, b) => a['Product Name'].localeCompare(b['Product Name']) || a.Size.localeCompare(b.Size));

  const priceRows = rows.filter((r) => r['Selling Price (NGN)'] !== null);
  const unpriced = rows.filter((r) => r['Selling Price (NGN)'] === null);

  const summary = [
    ['Tenant', tenant.name],
    ['Slug', tenant.slug],
    ['Currency', 'NGN'],
    ['SubProducts', subProducts.length],
    ['Price rows (one per size)', rows.length],
    ['Rows with a selling price', priceRows.length],
    ['Rows missing a selling price', unpriced.length],
    ['Distinct products', productIds.length],
    ['Size variants', sizeIds.length],
    ['Units in stock', totalStock],
    ['Retail value of stock (NGN)', Math.round(retail * 100) / 100],
    ['Cost value of stock (NGN)', Math.round(costValue * 100) / 100],
    ['Generated (UTC)', new Date().toISOString()],
  ];

  const wb = XLSX.utils.book_new();

  // Built as an AOA rather than json_to_sheet: json_to_sheet omits columns
  // whose values are all null, so ABV/Volume (populated on only 2 of 116 CKay
  // products) silently vanished from the header entirely.
  const COLUMNS = [
    'Product Name', 'SKU', 'Size', 'Size SKU', 'Brand', 'Category', 'Type',
    'ABV %', 'Volume (ml)', 'Units per Pack', 'Selling Price (NGN)',
    'Cost Price (NGN)', 'Margin %', 'Stock', 'Availability', 'Size Status',
    'Default Size', 'Product Status', 'SubProduct Status',
  ];
  const aoa = [COLUMNS, ...rows.map((r) => COLUMNS.map((c) => (r[c] === undefined ? '' : r[c])))];
  const wsRows = XLSX.utils.aoa_to_sheet(aoa);
  wsRows['!cols'] = [
    { wch: 34 }, { wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 20 },
    { wch: 14 }, { wch: 8 }, { wch: 11 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
  ];
  wsRows['!autofilter'] = { ref: wsRows['!ref'] };
  wsRows['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsRows, 'SubProducts & Prices');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  if (unpriced.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        COLUMNS,
        ...unpriced.map((r) => COLUMNS.map((c) => (r[c] === undefined ? '' : r[c]))),
      ]),
      'Missing Price'
    );
  }

  fs.writeFileSync(OUT, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`Wrote ${OUT}`);
  console.log(`  tenant      ${tenant.name} (${tenant.slug})`);
  console.log(`  subProducts ${subProducts.length}`);
  console.log(`  price rows  ${rows.length} (${unpriced.length} missing a price)`);
  console.log(`  stock       ${totalStock} units`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
