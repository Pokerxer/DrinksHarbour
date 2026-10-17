const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  buildCataloguePipeline,
  getSalesCatalogue,
} = require('../services/sales-catalogue');
const oid = () => new mongoose.Types.ObjectId();

test('catalogue caps page size, rejects invalid IDs and scopes before lookups', () => {
  const tenant = oid();
  const { pipeline, limit } = buildCataloguePipeline(String(tenant), {
    limit: 5000,
    page: -1,
  });
  assert.equal(limit, 48);
  assert.deepEqual(pipeline[0], { $match: { tenant } });
  const rows = pipeline.at(-1).$facet.products;
  assert.equal(pipeline.some(stage => stage.$lookup?.from === 'sizes'), false);
  assert.ok(rows.findIndex(stage => stage.$lookup?.from === 'sizes') > rows.findIndex(stage => stage.$limit));
  assert.ok(
    rows.findIndex((stage) => stage.$sort) <
      rows.findIndex((stage) => stage.$skip !== undefined),
  );
  assert.ok(
    rows.findIndex((stage) => stage.$match) <
      rows.findIndex((stage) => stage.$skip !== undefined),
  );
  assert.throws(
    () => buildCataloguePipeline(String(tenant), { categories: 'invalid' }),
    /Invalid catalogue filter/,
  );
});

const uri = process.env.DRINKSHARBOUR_CATALOGUE_TEST_MONGO_URI;
test('multiple product phrases match any phrase across names, SKUs and barcodes', () => {
  const { pipeline } = buildCataloguePipeline(String(oid()), { search: 'Cabernet, Whisky; SKU-83\n[75cl]' });
  const match = pipeline.at(-1).$facet.products[0].$match;
  assert.equal(match.$or.length, 16);
  const names = match.$or.map(clause => clause['product.name']).filter(Boolean);
  assert.ok(names.some(regex => regex.test('Red Cabernet')));
  assert.ok(names.some(regex => regex.test('Whisky Reserve')));
  assert.ok(names.some(regex => regex.test('Special [75cl]')));
  assert.equal(names.some(regex => regex.test('Unrelated gin')), false);
});

test(
  'catalogue pagination, facets, prices, packs and warehouse availability use the complete tenant catalogue',
  { skip: !uri },
  async (t) => {
    assert.match(
      uri,
      /^mongodb:\/\/127\.0\.0\.1:27139\/drinks_catalogue_test_[\w]+$/,
    );
    await mongoose.connect(uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 3000,
    });
    t.after(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const db = mongoose.connection.db;
    const tenant = oid(),
      foreign = oid(),
      warehouse = oid(),
      otherWarehouse = oid(),
      foreignWarehouse = oid();
    const category = oid(),
      brand = oid(),
      otherBrand = oid(),
      rare = oid();
    await db.collection('warehouses').insertMany([
      { _id: warehouse, tenant },
      { _id: otherWarehouse, tenant },
      { _id: foreignWarehouse, tenant: foreign },
    ]);
    await db.collection('brands').insertMany([
      { _id: brand, name: 'Everyday' },
      { _id: rare, name: 'Rare brand' },
      { _id: otherBrand, name: 'Other warehouse only' },
    ]);
    await db
      .collection('categories')
      .insertOne({ _id: category, name: 'Spirits' });
    const products = [],
      subproducts = [],
      sizes = [],
      stock = [];
    for (let i = 0; i < 85; i++) {
      const product = oid(),
        sub = oid(),
        size = oid();
      products.push({
        _id: product,
        name: `Bottle ${String(i).padStart(3, '0')}`,
        type: 'spirit',
        brand: i < 4 ? otherBrand : i === 80 ? rare : brand,
        category,
        description: 'heavy field'.repeat(10000),
        images: [{ url: 'https://example.com/bottle.jpg' }],
      });
      subproducts.push({
        _id: sub,
        tenant: i === 84 ? foreign : tenant,
        product,
        sku: `SKU-${i}`,
        sizes: [size],
        baseSellingPrice: i + 100,
        costPrice: 20,
        taxRate: 7.5,
        availableStock: 100,
        totalStock: 100,
        tenantNotes: 'private',
        embeddingOverride: [1, 2, 3],
      });
      sizes.push({
        _id: size,
        tenant: i === 84 ? foreign : tenant,
        subproduct: sub,
        size: '75cl',
        displayName: '75cl',
        sellingPrice: i + 100,
        costPrice: 21,
        sku: `SIZE-${i}`,
        barcode: `BAR-${i}`,
        unitsPerPack: 12,
        stock: 100,
        availableStock: 100,
      });
      stock.push({
        tenant: i === 84 ? foreign : tenant,
        warehouse: i < 4 ? otherWarehouse : warehouse,
        subProduct: sub,
        size,
        currentQuantity: i === 81 ? 7 : 10,
        reservedQuantity: i === 81 ? 7 : 3,
      });
    }
    const otherSize = oid();
    subproducts[4].sizes.push(otherSize);
    sizes.push({ _id: otherSize, tenant, subproduct: subproducts[4]._id,
      size: '1L', sku: 'OTHER-WAREHOUSE-SIZE', sellingPrice: 99999 });
    stock.push({ tenant, warehouse: otherWarehouse, subProduct: subproducts[4]._id,
      size: otherSize, currentQuantity: 50, reservedQuantity: 0 });
    await Promise.all([
      db.collection('products').insertMany(products),
      db.collection('subproducts').insertMany(subproducts),
      db.collection('sizes').insertMany(sizes),
      db.collection('warehousestocks').insertMany(stock),
    ]);
    const options = {
      page: 1,
      limit: 24,
      warehouseId: String(warehouse),
      facets: 'true',
      catalogueSort: 'name',
    };
    const start = performance.now();
    const first = await getSalesCatalogue(String(tenant), options);
    const elapsed = performance.now() - start;
    assert.equal(first.subProducts.length, 24);
    assert.equal(first.pagination.total, 80);
    assert.equal(first.subProducts[0].product.name, 'Bottle 004');
    assert.equal(first.subProducts[0].sizes.length, 1);
    assert.equal(first.subProducts[0].availableStock, 7);
    assert.equal(first.subProducts[0].sizes[0].availableStock, 7);
    assert.equal(first.subProducts[0].sizes[0].unitsPerPack, 12);
    assert.equal(first.subProducts[0].sizes[0].costPrice, 21);
    assert.equal(first.subProducts[0].tenantNotes, undefined);
    assert.equal(first.subProducts[0].product.description, undefined);
    assert.equal(first.subProducts[0].embeddingOverride, undefined);
    assert.ok(
      first.facets.brands.some((option) => String(option.id) === String(rare)),
    );
    assert.equal(first.facets.brands.some(option => String(option.id) === String(otherBrand)), false);
    const allLocations = await getSalesCatalogue(String(tenant), {
      ...options, warehouseId: undefined,
    });
    assert.equal(allLocations.pagination.total, 84);
    const emptyWarehouse = oid();
    await db.collection('warehouses').insertOne({ _id: emptyWarehouse, tenant });
    const empty = await getSalesCatalogue(String(tenant), {
      ...options, warehouseId: String(emptyWarehouse),
    });
    assert.equal(empty.pagination.total, 0);
    assert.deepEqual(empty.subProducts, []);
    assert.deepEqual(empty.facets.brands, []);
    const last = await getSalesCatalogue(String(tenant), {
      ...options,
      page: 4,
      facets: 'false',
    });
    assert.equal(last.subProducts.length, 8);
    assert.equal(last.pagination.hasNext, false);
    assert.equal(last.facets, undefined);
    const found = await getSalesCatalogue(String(tenant), {
      ...options,
      brands: String(rare),
    });
    assert.equal(found.pagination.total, 1);
    assert.equal(found.subProducts[0].product.name, 'Bottle 080');
    const barcode = await getSalesCatalogue(String(tenant), {
      ...options,
      search: 'BAR-83',
    });
    assert.equal(barcode.pagination.total, 1);
    const otherVariant = await getSalesCatalogue(String(tenant), {
      ...options, search: 'OTHER-WAREHOUSE-SIZE',
    });
    assert.equal(otherVariant.pagination.total, 0);
    const zeroStock = await getSalesCatalogue(String(tenant), {
      ...options, search: 'Bottle 081',
    });
    assert.equal(zeroStock.pagination.total, 1);
    assert.equal(zeroStock.subProducts[0].availableStock, 0);
    const otherPage = await getSalesCatalogue(String(tenant), {
      ...options, warehouseId: String(otherWarehouse),
    });
    assert.equal(otherPage.pagination.total, 5);
    const sorted = await getSalesCatalogue(String(tenant), {
      ...options,
      catalogueSort: 'priceDesc',
    });
    assert.equal(sorted.subProducts[0].product.name, 'Bottle 083');
    const stocked = await getSalesCatalogue(String(tenant), {
      ...options,
      search: 'Bottle 081',
      inStock: 'true',
    });
    assert.equal(stocked.pagination.total, 0);
    await assert.rejects(
      getSalesCatalogue(String(tenant), {
        ...options,
        warehouseId: String(foreignWarehouse),
      }),
      /not found for this tenant/,
    );
    const legacyBytes = Buffer.byteLength(
      JSON.stringify(
        subproducts
          .slice(0, 60)
          .map((sp, i) => ({ ...sp, product: products[i], sizes: [sizes[i]] })),
      ),
    );
    t.diagnostic(
      `Local fixture: ${elapsed.toFixed(1)} ms; compact page ${Buffer.byteLength(JSON.stringify(first))} bytes vs old 60-record payload ${legacyBytes} bytes (large descriptions fixture).`,
    );
  },
);

test('tenant catalogue size projection includes wholesale price for selected pricelist formulas',()=>{
 const {pipeline}=buildCataloguePipeline(String(oid()),{});
 const rows=pipeline.at(-1).$facet.products;
 const lookup=rows.find(stage=>stage.$lookup?.from==='sizes').$lookup;
 assert.equal(lookup.pipeline.find(stage=>stage.$project).$project.wholesalePrice,1);
});
