const test = require('node:test');
const assert = require('node:assert');

const { commitImport } = require('../services/subProductImport.service');

/**
 * Opening stock must land ONCE on Size.stock.
 *
 * The import writes the warehouse ledger (adjustStock), the per-size figure
 * (Size.stock) and the audit trail (recordReceiptMovement) — and
 * recordReceiptMovement itself $inc's Size.stock. Applying an absolute $set AND
 * that $inc for the same receipt doubles every imported size.
 */

// Minimal in-memory Size store that understands the $set / $inc this code uses.
function makeSizeStore(initial = {}) {
  const docs = new Map(Object.entries(initial));
  return {
    docs,
    model: {
      findByIdAndUpdate(id, update) {
        const doc = docs.get(String(id)) || { stock: 0, availableStock: 0 };
        for (const [k, v] of Object.entries(update.$set || {})) doc[k] = v;
        for (const [k, v] of Object.entries(update.$inc || {})) doc[k] = (doc[k] || 0) + v;
        docs.set(String(id), doc);
        return Promise.resolve(doc);
      },
      find() { return { select: () => ({ lean: async () => [] }) }; },
    },
  };
}

// recordReceiptMovement's real Size side effect (inventory.service.js).
function makeRecordReceipt(sizeStore, calls) {
  return async (args) => {
    calls.push(args);
    if (args.size) {
      await sizeStore.model.findByIdAndUpdate(args.size, {
        $inc: { stock: args.quantity, availableStock: args.quantity },
        $set: { availability: 'in_stock', status: 'active' },
      });
    }
    return { _id: 'mv1' };
  };
}

function baseDeps(sizeStore, extra = {}) {
  const warehouseQty = { value: 0 };
  return {
    warehouseQty,
    deps: {
      Product: { find: () => ({ select: () => ({ lean: async () => [] }) }) },
      SubProduct: { findOne: () => ({ select: () => ({ lean: async () => null }) }) },
      Size: sizeStore.model,
      Category: {},
      Tenant: { findById: () => ({ select: () => ({ lean: async () => null }) }) },
      getCategoryOptions: async () => ({ categories: [], subcategories: {} }),
      getProductNames: async () => [],
      enrich: async () => ({ type: 'wine' }),
      preserveMarkup: () => {},
      adjustStock: async ({ quantity, type }) => {
        if (type === 'adjusted') warehouseQty.value = quantity;
        else warehouseQty.value += quantity;
      },
      createSubProduct: async () => ({
        _id: 'sub1',
        product: 'prod1',
        sizes: [{ _id: 'size1', size: '75cl' }],
      }),
      addSize: async () => ({ _id: 'size1' }),
      ...extra,
    },
  };
}

test('create-mode import applies opening stock to Size.stock exactly once', async () => {
  const sizeStore = makeSizeStore();
  const calls = [];
  const { deps, warehouseQty } = baseDeps(sizeStore);
  deps.recordReceiptMovement = makeRecordReceipt(sizeStore, calls);

  const rows = [{
    productName: 'Antinori Tignanello Toscana',
    size: '75cl',
    costPrice: 24964,
    sellingPrice: 31300,
    openingQty: 5,
  }];

  const out = await commitImport(rows, { warehouseId: 'wh1' }, 'tenant1', { _id: 'user1' }, deps);

  assert.deepStrictEqual(out.errors, []);
  assert.strictEqual(out.stockApplied, 1);
  assert.strictEqual(warehouseQty.value, 5, 'warehouse ledger receives 5');
  assert.strictEqual(sizeStore.docs.get('size1').stock, 5, 'Size.stock must be 5, not double-counted');
  assert.strictEqual(sizeStore.docs.get('size1').availableStock, 5);
});

test('create-mode import still sets Size.stock when the audit trail fails', async () => {
  const sizeStore = makeSizeStore();
  const { deps } = baseDeps(sizeStore);
  deps.recordReceiptMovement = async () => { throw new Error('movement write failed'); };

  const rows = [{
    productName: 'Antinori Tignanello Toscana',
    size: '75cl',
    costPrice: 24964,
    sellingPrice: 31300,
    openingQty: 5,
  }];

  const out = await commitImport(rows, { warehouseId: 'wh1' }, 'tenant1', { _id: 'user1' }, deps);

  assert.deepStrictEqual(out.errors, []);
  assert.strictEqual(sizeStore.docs.get('size1').stock, 5);
  assert.strictEqual(sizeStore.docs.get('size1').availableStock, 5);
  assert.strictEqual(sizeStore.docs.get('size1').availability, 'in_stock');
});

test('update-mode stock-take sets the absolute quantity, not double it', async () => {
  const sizeStore = makeSizeStore({ size1: { stock: 4, availableStock: 4 } });
  const calls = [];
  const { deps, warehouseQty } = baseDeps(sizeStore, {
    Product: {
      find: () => ({ select: () => ({ lean: async () => [{ _id: 'prod1', name: 'Antinori Tignanello Toscana' }] }) }),
    },
    SubProduct: {
      findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'sub1' }) }) }),
      findById: () => ({ select: () => ({ lean: async () => ({ markupPercentage: 25 }) }) }),
    },
  });
  deps.recordReceiptMovement = makeRecordReceipt(sizeStore, calls);
  deps.Size = {
    ...sizeStore.model,
    find: () => ({
      select: () => ({
        lean: async () => [{ _id: 'size1', size: '75cl', stock: 4, costPrice: 24964, sellingPrice: 31300 }],
      }),
    }),
  };

  const rows = [{ productName: 'Antinori Tignanello Toscana', size: '75cl', openingQty: 10 }];

  const out = await commitImport(rows, { warehouseId: 'wh1', mode: 'update' }, 'tenant1', { _id: 'user1' }, deps);

  assert.deepStrictEqual(out.errors, []);
  assert.strictEqual(out.stockUpdated, 1);
  assert.strictEqual(warehouseQty.value, 10, 'warehouse ledger is set to the absolute 10');
  assert.strictEqual(sizeStore.docs.get('size1').stock, 10, 'Size.stock must be the absolute 10');
  assert.strictEqual(sizeStore.docs.get('size1').availableStock, 10);
});
