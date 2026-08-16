// server/__tests__/posProductCatalogueLimit.test.js
//
// How many rows /api/pos/products is allowed to leave behind.
//
// `getPOSProducts` defaulted to `limit = 200` and applied it as `.limit(200)`.
// Nothing above it ever raised that number: the POS client sends no `limit` at
// all, so the default WAS the cap. The tenant it was found on has 955
// POS-visible sub-products; 755 of them could not be sold from the terminal.
//
// The reason a short list is worse here than elsewhere is that the grid fetches
// ONCE and then searches, filters and paginates that array in memory — it has
// to, because an installed POS must keep selling with no network. So the cap
// silently truncates SEARCH too: a cashier typing the name of a product that
// sorts 600th gets "no results", which is indistinguishable from the product
// not existing. The sort is `isFeaturedByTenant, totalSold, availableStock`
// descending, so it is exactly the slow-moving tail — the stock nobody can
// recall and therefore has to look up — that disappears.
//
// These tests drive the real handler and assert on the response body, because
// a cap degrades to a shorter list rather than to an error: every unit
// involved behaves correctly on the rows it was handed, and a test that only
// checks "returns products" passes with the bug in place.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const SubProduct = require('../models/SubProduct');
const Warehouse = require('../models/Warehouse');
const pricelistService = require('../services/pricelist.service');
const pos = require('../controllers/pos.controller');

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();

/**
 * One POS-visible sub-product. `totalSold` descends with the index so the
 * fixture order IS the sort order the endpoint applies — index 0 is the
 * best-seller, the last index is the tail item a cap eats first.
 */
function row(i, total) {
  return {
    _id: oid(),
    tenant: TENANT,
    sku: `SKU-${String(i).padStart(4, '0')}`,
    product: {
      _id: oid(),
      name: `Product ${i}`,
      images: [],
      type: 'spirits',
      brand: { _id: oid(), name: 'Brand' },
      platformMarkup: 10,
    },
    baseSellingPrice: 1000,
    costPrice: 800,
    availableStock: 5,
    totalSold: total - i,
    isFeaturedByTenant: false,
    status: 'active',
    visibleInPOS: true,
    sellWithoutSizeVariants: true,
    sizes: [],
    bundleDeals: [],
  };
}

function catalogue(n) {
  return Array.from({ length: n }, (_, i) => row(i, n));
}

/**
 * A stand-in for the Mongoose query chain `getPOSProducts` builds. Only
 * `.sort()` and `.limit()` change the result — `.select()` and `.populate()`
 * are shape concerns the fixtures already satisfy — and `.limit()` is recorded
 * so a test can assert on what the endpoint asked the database for, not only
 * on what it returned.
 */
function fakeFind(rows, spy) {
  const q = {
    select: () => q,
    populate: () => q,
    sort(spec) {
      const entries = Object.entries(spec || {});
      q._rows = [...q._rows].sort((a, b) => {
        for (const [key, dir] of entries) {
          const cmp = (Number(a[key]) || 0) - (Number(b[key]) || 0);
          if (cmp !== 0) return dir < 0 ? -cmp : cmp;
        }
        return 0;
      });
      return q;
    },
    limit(n) {
      spy.limit = n;
      q._rows = q._rows.slice(0, Number(n));
      return q;
    },
    lean: async () => q._rows,
  };
  q._rows = rows;
  return q;
}

/** Install the three reads `getPOSProducts` makes besides the catalogue itself. */
function stub(rows) {
  const spy = { limit: null };
  const originals = { find: SubProduct.find, findOne: Warehouse.findOne, resolve: pricelistService.resolveShopPricelist };

  SubProduct.find = () => fakeFind(rows, spy);
  // No default warehouse: the endpoint then reports SubProduct-level stock and
  // never touches WarehouseStock, which keeps these tests about the row count.
  Warehouse.findOne = () => ({ select: () => ({ lean: async () => null }) });
  pricelistService.resolveShopPricelist = async () => ({ resolved: null });

  return {
    spy,
    restore() {
      SubProduct.find = originals.find;
      Warehouse.findOne = originals.findOne;
      pricelistService.resolveShopPricelist = originals.resolve;
    },
  };
}

/** Run the real handler and hand back the parsed response body. */
async function getProducts(query = {}) {
  const res = {};
  res.set = () => res;
  res.status = function status(code) { res.status = code; return res; };
  res.json = function json(payload) {
    res.body = payload;
    if (typeof res.status === 'function') res.status = 200;
    return res;
  };
  await pos.getPOSProducts(
    { tenant: { _id: TENANT, revenueModel: 'markup' }, query },
    res,
    (err) => { throw err; }
  );
  assert.strictEqual(res.status, 200);
  return res.body.data;
}

test('the POS catalogue is not cut off at 200 rows', async (t) => {
  const s = stub(catalogue(260));
  t.after(s.restore);

  const data = await getProducts();

  assert.strictEqual(
    data.products.length,
    260,
    'the endpoint capped a 260-product catalogue — the rows past the cap cannot be sold, searched or even seen from the terminal'
  );
  assert.strictEqual(data.truncated, false);
});

test('a slow-moving product past the old 200-row cap is still findable by name', async (t) => {
  // The cashier-visible half of the same bug. Search is applied by this
  // endpoint AFTER the row limit, and by the client entirely in memory over
  // what it was sent, so a capped catalogue answers "no such product" for
  // stock that is sitting on the shelf.
  const rows = catalogue(260);
  const tail = rows[250];
  const s = stub(rows);
  t.after(s.restore);

  const data = await getProducts({ search: tail.product.name });

  assert.deepStrictEqual(
    data.products.map((p) => p.sku),
    [tail.sku],
    `"${tail.product.name}" sorts 251st, so a 200-row cap makes it unfindable — the cashier sees no results for a product that is in stock`
  );
});

test('an explicit limit is still honoured, and says so when it truncates', async (t) => {
  // A cap is allowed to exist; being silent about it is what cost a week.
  const s = stub(catalogue(260));
  t.after(s.restore);

  const data = await getProducts({ limit: '50' });

  assert.strictEqual(data.products.length, 50);
  assert.strictEqual(data.limit, 50);
  assert.strictEqual(
    data.truncated,
    true,
    'the response has to admit that rows were left behind — a caller cannot tell a short catalogue from a complete one'
  );
});

test('the catalogue is capped at 5000 rows, whatever the caller asks for', async (t) => {
  const s = stub(catalogue(5100));
  t.after(s.restore);

  const data = await getProducts({ limit: '999999' });

  assert.strictEqual(data.products.length, 5000);
  assert.strictEqual(data.truncated, true);
  // Asked of the database, not just of the response: the cap has to bound the
  // query, or a tenant with 50k sub-products pulls all of them into memory to
  // throw them away.
  assert.ok(
    s.spy.limit <= 5001,
    `the query asked for ${s.spy.limit} rows — the cap must bound what is read, not only what is sent`
  );
});

test('a garbage limit falls back to the full catalogue rather than to nothing', async (t) => {
  // `Number('all')` is NaN and `.limit(NaN)` is not a cap a cashier can
  // interpret. Anything unusable means "the whole catalogue".
  const s = stub(catalogue(260));
  t.after(s.restore);

  for (const limit of ['all', '0', '-5']) {
    const data = await getProducts({ limit });
    assert.strictEqual(data.products.length, 260, `limit=${limit} returned ${data.products.length} rows`);
    assert.strictEqual(data.truncated, false);
  }
});
