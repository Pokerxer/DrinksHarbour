/**
 * Dev utility: reset all stock/history then bulk-import an Excel file.
 *
 * Usage (from the server/ directory):
 *   node scripts/reset-and-import.js [path-to-xlsx] [warehouseName]
 *
 * Defaults:
 *   xlsx:      ~/Downloads/Untitled spreadsheet (5).xlsx
 *   warehouse: Main Warehouse
 */
'use strict';

require('dotenv').config();

const path      = require('path');
const os        = require('os');
const XLSX      = require('xlsx');
const mongoose  = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');

// Pre-register every model so service layers can reference them via mongoose.model()
const MODELS = [
  'Activity','Address','AuditLog','Banner','Brand','Cart','CartItem','Category',
  'Coupon','CustomField','ExchangeRate','FlashSale','Flavor','GiftCard',
  'GiftCardTransaction','InventoryMovement','JournalEntry','LoyaltyTransaction',
  'Meeting','Notification','Order','POSCombo','POSCustomer','POSSession',
  'PaymentMethod','PlatformLoyaltyTransaction','PlatformSettlement',
  'PlatformWalletTransaction','PriceHistory','Pricelist','Product','Promo',
  'Promotion','PurchaseAgreement','PurchaseOrder','RefreshToken','ReorderRule',
  'Review','Sale','Sales','SalesOrder','ScheduledPriceChange','Shipping',
  'ShippingMethod','Size','StockMovement','StockTransfer','SubCategory',
  'SubProduct','Tag','Task','Tenant','UOMConversion','User','Vendor',
  'VendorBill','VendorPricelist','VendorReturn','WalletTransaction','Warehouse',
  'WarehouseBatch','WarehouseMovement','WarehouseStock','WebAnalytics','Wishlist',
];
for (const m of MODELS) {
  try { require(`../models/${m}`); } catch (_) {}
}

const IMPORT_COLUMNS = [
  'productName','productType','brand','category','subCategory',
  'subProductSku','costPrice','sellingPrice','size','sizeSku',
  'barcode','sizePrice','sizeCostPrice','openingQty',
];

const XLSX_FILE    = process.argv[2] || path.join(os.homedir(), 'Downloads/Untitled spreadsheet (5).xlsx');
const WH_NAME      = process.argv[3] || 'Main Warehouse';
const TENANT_ID    = '699165839f3308b1baeca8fc'; // Drinks Harbour

// ─── helpers ────────────────────────────────────────────────────────────────

const PRICE_COLS = new Set(['costPrice', 'sellingPrice', 'sizePrice', 'sizeCostPrice']);

function roundUp100(val) {
  const n = Number(val);
  return isNaN(n) || n === 0 ? val : Math.ceil(n / 100) * 100;
}

function parseXlsx(filePath) {
  const wb    = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw   = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return raw.map(r => {
    const row = {};
    for (const col of IMPORT_COLUMNS) {
      const key = Object.keys(r).find(k => k.trim().toLowerCase() === col.toLowerCase());
      row[col] = key !== undefined ? r[key] : '';
    }

    // Round all price columns up to nearest 100
    for (const col of PRICE_COLS) {
      if (row[col] !== '') row[col] = roundUp100(row[col]);
    }

    // Clamp: costPrice must not exceed sellingPrice (prevents negative margin)
    if (row.costPrice > row.sellingPrice && row.sellingPrice > 0) {
      console.warn(`⚠️  "${row.productName}": costPrice (${row.costPrice}) > sellingPrice (${row.sellingPrice}) — clamping cost to selling price`);
      row.costPrice = row.sellingPrice;
    }
    if (row.sizeCostPrice > row.sizePrice && row.sizePrice > 0) {
      row.sizeCostPrice = row.sizePrice;
    }

    return row;
  });
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();
  console.log('✅ Connected to MongoDB\n');

  // ── 1. Grab model references (already registered above) ────────────────
  const Size              = mongoose.model('Size');
  const SubProduct        = mongoose.model('SubProduct');
  const WarehouseStock    = mongoose.model('WarehouseStock');
  const InventoryMovement = mongoose.model('InventoryMovement');
  const WarehouseMovement = mongoose.model('WarehouseMovement');
  const Warehouse         = mongoose.model('Warehouse');

  // ── 2. Full wipe: products + stock + history ────────────────────────────
  console.log('── Wiping products, stock & history ───────────────────────');
  const tenantOid = new mongoose.Types.ObjectId(TENANT_ID);
  const [spR, sR, wsR, imR, wmR] = await Promise.all([
    SubProduct.deleteMany({ tenant: tenantOid }),
    Size.deleteMany({ tenant: tenantOid }),
    WarehouseStock.deleteMany({}),
    InventoryMovement.deleteMany({}),
    WarehouseMovement.deleteMany({}),
  ]);
  console.log(`  SubProducts deleted:    ${spR.deletedCount}`);

  // Approve any Products left in pending so re-import links instead of re-creating them
  const Product = mongoose.model('Product');
  const approveRes = await Product.updateMany({ status: 'pending' }, { $set: { status: 'approved' } });
  console.log(`  Products approved:      ${approveRes.modifiedCount}`);
  console.log(`  Sizes deleted:          ${sR.deletedCount}`);
  console.log(`  WarehouseStock deleted: ${wsR.deletedCount}`);
  console.log(`  InventoryMovement del:  ${imR.deletedCount}`);
  console.log(`  WarehouseMovement del:  ${wmR.deletedCount}\n`);

  // ── 3. Resolve warehouse ────────────────────────────────────────────────
  const wh = await Warehouse.findOne({ name: { $regex: new RegExp(WH_NAME, 'i') }, isActive: true }).lean();
  if (!wh) {
    console.error(`Warehouse "${WH_NAME}" not found. Aborting.`);
    process.exit(1);
  }
  const warehouseId = String(wh._id);
  console.log(`── Using warehouse: ${wh.name} (${warehouseId})\n`);

  // ── 4. Parse spreadsheet ────────────────────────────────────────────────
  console.log(`── Parsing: ${path.basename(XLSX_FILE)}`);
  const rows = parseXlsx(XLSX_FILE);
  console.log(`  ${rows.length} rows parsed\n`);

  // ── 5. Preview (AI enrichment) ──────────────────────────────────────────
  const importSvc = require('../services/subProductImport.service');

  console.log('── Running preview + AI enrichment (may take ~30 s) ───────');
  const preview = await importSvc.validateImport(rows, { warehouseId }, TENANT_ID);

  const totals = preview.totals;
  console.log(`  Groups:         ${totals.groups}`);
  console.log(`  New products:   ${totals.willCreateProduct}`);
  console.log(`  Link existing:  ${totals.willLinkProduct}`);
  console.log(`  Update existing:${totals.willUpdateSubProduct}`);
  console.log(`  Error rows:     ${totals.errorRows}`);

  if (preview.blocking.length) {
    console.warn('\n⚠️  Blocking issues:');
    preview.blocking.forEach(b => console.warn('  •', b));
  }

  if (totals.errorRows > 0) {
    console.warn('\n⚠️  Row errors (still committing valid groups):');
    for (const g of preview.groups) {
      for (const e of g.rowErrors) {
        console.warn(`  Row ${e.rowNum} [${g.productName}]: ${e.message}`);
      }
    }
  }

  // ── 6. Commit ────────────────────────────────────────────────────────────
  const enrichments = Object.fromEntries(
    preview.groups
      .filter(g => g.action === 'createProduct' && g.enrichment)
      .map(g => [g.key, g.enrichment])
  );

  console.log('\n── Committing import ──────────────────────────────────────');
  const result = await importSvc.commitImport(
    rows,
    { warehouseId, enrichments },
    TENANT_ID,
    { _id: new mongoose.Types.ObjectId(), role: 'super_admin' }, // synthetic user — bypasses pending status filter
    undefined
  );

  console.log('\n✅ Import complete:');
  console.log(`  Products created: ${result.createdProducts}`);
  console.log(`  SubProducts:      ${result.createdSubProducts}`);
  console.log(`  Sizes:            ${result.createdSizes}`);
  console.log(`  Stock lines:      ${result.stockApplied}`);
  console.log(`  Skipped:          ${result.skipped}`);
  if (result.errors.length) {
    console.warn(`\n⚠️  ${result.errors.length} group(s) had errors:`);
    result.errors.forEach(e => console.warn(`  • ${e.group}: ${e.message}`));
  }

  await disconnectDB();
}

main().catch(err => {
  console.error('\n❌ Script failed:', err.message);
  process.exit(1);
});
