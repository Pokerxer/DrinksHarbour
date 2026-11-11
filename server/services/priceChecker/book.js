const Size = require('../../models/Size');
const SubProduct = require('../../models/SubProduct');
const Product = require('../../models/Product');
const WarehouseStock = require('../../models/WarehouseStock');
const { resolvePrice, stockState } = require('./pricing');
const { normalizeBarcode, defaults } = require('./validation');
const { publicConfig, publicProduct, CATALOGUE_FIELDS, CATALOGUE_REFS } = require('./serialization');
const { lookup } = require('./lookup');
const { logScan, scanRequestId } = require('./scans');
const { ValidationError } = require('../../utils/errors');

const SELLABLE = ['active', 'seasonal', 'limited_edition'];
const SELLABLE_SUBPRODUCT_STATUS = ['active', 'low_stock', 'out_of_stock'];
const BOOK_CAP = 4000;

/**
 * Whole-warehouse pricebook for a kiosk's offline cache. Same sellability
 * rules and pricing pipeline as the single-scan lookup, collapsed into one
 * read-friendly list of public fields (no internal ids).
 */
async function buildBook(context) {
  const { kiosk, pricelist, tenant } = context;
  const sizes = await Size.find({
    tenant: kiosk.tenant,
    status: { $in: SELLABLE },
    barcode: { $type: 'string', $ne: '' },
  })
    .select(
      '_id subproduct size displayName volumeMl barcode sellingPrice costPrice wholesalePrice currency status'
    )
    .limit(BOOK_CAP)
    .lean();
  const barcodes = sizes.filter((row) => row.barcode).map((row) => row.barcode);
  if (!barcodes.length) return serializeBook(context, [], []);
  // Lookup rejects a barcode shared with any other size, even an inactive one.
  const barcodeRows = await Size.find({ tenant: kiosk.tenant, barcode: { $in: barcodes } })
    .select('barcode')
    .lean();
  const seen = new Set();
  const ambiguous = new Set();
  for (const row of barcodeRows) {
    if (seen.has(row.barcode)) ambiguous.add(row.barcode);
    seen.add(row.barcode);
  }
  const withBarcode = sizes.filter((row) => row.barcode && !ambiguous.has(row.barcode));

  const subs = await SubProduct.find({
    _id: { $in: withBarcode.map((row) => row.subproduct) },
    tenant: kiosk.tenant,
    isPublished: true,
    visibleInPOS: { $ne: false },
    status: { $in: SELLABLE_SUBPRODUCT_STATUS },
  })
    .select('_id product baseSellingPrice basePriceBeforePricelist costPrice currency')
    .lean();
  const subsById = new Map(subs.map((row) => [String(row._id), row]));

  const products = await Product.find({
    _id: { $in: subs.map((row) => row.product) },
    status: 'approved',
    isPublished: true,
  })
    .select(CATALOGUE_FIELDS)
    .populate(CATALOGUE_REFS)
    .lean();
  const productsById = new Map(products.map((row) => [String(row._id), row]));

  const stocks = await WarehouseStock.find({
    tenant: kiosk.tenant,
    warehouse: kiosk.location,
    size: { $in: withBarcode.map((row) => row._id) },
  })
    .select('size subProduct currentQuantity reservedQuantity minStockLevel')
    .lean();
  const stockBySize = new Map(stocks.map((row) => [`${row.size}:${row.subProduct}`, row]));
  const settings = { ...defaults, ...kiosk.settings };
  const unavailableBarcodes = [...ambiguous];

  const items = [];
  for (const size of withBarcode) {
    const subProduct = subsById.get(String(size.subproduct));
    const product = subProduct && productsById.get(String(subProduct.product));
    if (!subProduct || !product) continue;
    const stock = stockState(stockBySize.get(`${size._id}:${subProduct._id}`));
    if (settings.outOfStock === 'HIDE' && stock.quantity <= 0) continue;
    let pricing;
    try {
      pricing = resolvePrice({
        size,
        subProduct,
        pricelist,
        currency: kiosk.currency,
        tenant,
      });
    } catch (error) {
      if (error.statusCode !== 400) throw error;
      unavailableBarcodes.push(size.barcode);
      continue;
    }
    items.push({
      ...publicProduct({ product, size, pricing, stock, settings }),
      barcode: size.barcode,
      ...(stock.quantity > 0 ? { suggestible: true } : {}),
    });
  }
  return serializeBook(context, items, unavailableBarcodes);
}

function serializeBook(context, items, unavailableBarcodes) {
  return {
    slug: context.kiosk.slug,
    currency: context.kiosk.currency,
    config: publicConfig(context),
    generatedAt: new Date().toISOString(),
    items,
    unavailableBarcodes,
  };
}

const SYNC_BATCH_CAP = 50;
const SYNC_TIME_WINDOW = 7 * 86400_000;

/** Accepts an ISO-or-parseable timestamp clamped to the last 7 days.
 *  Unparseable values throw — the kiosk queued garbage, reject the entry. */
function syncScannedAt(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) fail('Invalid scan time.');
  const now = Date.now();
  const clamped = Math.max(now - SYNC_TIME_WINDOW, Math.min(time, now));
  return new Date(clamped);
}

/**
 * Offline scan batch ingestion. Each entry is checked independently so one
 * bad barcode can't discard a customer's whole queue, and the standard
 * lookup + logScan pipeline records them (with the kiosk's own timestamps,
 * clamped) exactly as if they had arrived live.
 */
async function buildSync(context, body) {
  const scans = requireScans(body);
  if (scans.length > SYNC_BATCH_CAP) fail(`Send at most ${SYNC_BATCH_CAP} offline scans per batch.`);
  const seen = new Set();
  const results = { synced: [], rejected: [] };
  for (const scan of scans) {
    const requestId = typeof scan.requestId === 'string' ? scan.requestId : '';
    if (seen.has(requestId)) {
      results.rejected.push({
        requestId,
        error: 'This scan was already sent in this batch.',
      });
      continue;
    }
    seen.add(requestId);
    try {
      const barcode = normalizeBarcode(scan.barcode);
      const id = scanRequestId(requestId);
      if (results.synced.some((row) => row.requestId === id))
        throw new Error('This scan was already sent in this batch.');
      const logged = await lookup(context, barcode);
      await logScan(
        context,
        barcode,
        id,
        logged,
        'kiosk',
        syncScannedAt(scan.scannedAt)
      );
      results.synced.push({ requestId: id });
    } catch (error) {
      results.rejected.push({ requestId, error: String(error.message || 'Rejected.') });
    }
  }
  return results;
}

function requireScans(body) {
  const list = body?.scans;
  if (!Array.isArray(list) || !list.length) fail('Send offline scans to sync.');
  return list;
}

function fail(message) {
  throw new ValidationError(message);
}

module.exports = { buildBook, buildSync, syncScannedAt };
