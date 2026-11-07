// Replaces the sparse marketplace bridge index, which incorrectly includes
// manual SalesOrders with marketplaceOrderId: null in its tenant compound key.
// Preview by default. Applying requires an explicit URI and --apply; never
// source an application dotenv file implicitly.
const mongoose = require('mongoose');

const KEY = { tenant: 1, marketplaceOrderId: 1 };
const NEW_NAME = 'sales_marketplace_order_unique_v2';
const NEW_OPTIONS = {
  name: NEW_NAME,
  unique: true,
  partialFilterExpression: { marketplaceOrderId: { $type: 'objectId' } },
};

function isBridgeIndex(index) {
  return index.key?.tenant === 1 && index.key?.marketplaceOrderId === 1 &&
    Object.keys(index.key).length === 2;
}

function isNewIndex(index) {
  return index.name === NEW_NAME && isBridgeIndex(index) && index.unique === true &&
    index.partialFilterExpression?.marketplaceOrderId?.$type === 'objectId';
}

async function run() {
  if (process.argv.slice(2).some((arg) => arg !== '--apply')) {
    throw new Error('Only --apply is supported; omit it for a read-only preview');
  }
  const uri = process.env.DRINKSHARBOUR_SALES_ORDER_INDEX_MONGO_URI;
  if (!uri) throw new Error('Set DRINKSHARBOUR_SALES_ORDER_INDEX_MONGO_URI explicitly');
  await mongoose.connect(uri, { autoIndex: false });
  const collection = mongoose.connection.collection('salesorders');
  const indexes = await collection.indexes();
  const old = indexes.filter((index) => isBridgeIndex(index) && index.sparse === true && index.unique === true);
  const named = indexes.find((index) => index.name === NEW_NAME);
  if (named && !isNewIndex(named)) throw new Error(`${NEW_NAME} exists with incompatible options`);
  const other = indexes.filter((index) => isBridgeIndex(index) && index !== named && !old.includes(index));
  if (other.length) throw new Error(`Unexpected bridge indexes: ${other.map((index) => index.name).join(', ')}`);

  const action = process.argv.includes('--apply') ? 'Apply' : 'Preview';
  console.log(`${action} on database ${mongoose.connection.name}: ${named ? 'v2 present' : 'create v2'}, ${old.length ? `drop ${old.map((index) => index.name).join(', ')}` : 'no legacy index'}`);
  if (action === 'Preview') return;

  if (!named) await collection.createIndex(KEY, NEW_OPTIONS);
  const installed = (await collection.indexes()).find((index) => index.name === NEW_NAME);
  if (!isNewIndex(installed)) throw new Error('V2 index was not verified; legacy index retained');
  for (const index of old) await collection.dropIndex(index.name);
  console.log('V2 index verified; legacy sparse index removed');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
