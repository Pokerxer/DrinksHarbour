/**
 * seed-gift-packaging.js
 *
 * Creates (or updates) the single paid gift-packaging SKU used by gift
 * checkout (docs/superpowers/specs/2026-10-27-gift-checkout-design.md):
 *
 *   Product  "Gift packaging" — isGiftPackaging: true, status 'pending'
 *   SubProduct on the designated tenant — active, published, priced
 *   Size "unit" on that SubProduct — priced at GIFT_PACKAGING_PRICE_NAIRA
 *
 * The customer price is always exactly GIFT_PACKAGING_PRICE_NAIRA (default
 * ₦5,000, rounded to the nearest ₦100 because platform prices round up to
 * 100s). For markup-model tenants the script inverts the forward pricing
 * chain (cost = price / (1 + markup%) with a 0% platform markup override on
 * the size); for commission-model tenants the size's sellingPrice IS the
 * customer price. If the tenant's markup changes later, re-run to re-pin.
 *
 * The seed NEVER publishes the Product to the storefront — it is created with
 * status 'pending' and the super-admin approves + publishes it from the admin
 * panel (the deployment step). An existing product keeps its status.
 *
 * Idempotent: re-running updates price/stock fields instead of duplicating.
 *
 *   node scripts/seed-gift-packaging.js
 *   GIFT_PACKAGING_PRICE_NAIRA=3000 GIFT_PACKAGING_TENANT_ID=<id> node scripts/seed-gift-packaging.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const Tenant = require('../models/Tenant');

const PRODUCT_NAME = 'Gift packaging';
const SLUG = 'gift-packaging';
const SKU = 'GIFT-PACKAGING';
const STOCK = 1000;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  console.log('Connected.');

  // Platform prices always round up to the nearest ₦100 — pin the same figure
  // here so the advertised price and the seed's stored price agree exactly.
  const price = Math.ceil((Number(process.env.GIFT_PACKAGING_PRICE_NAIRA) || 5000) / 100) * 100;

  // Owning tenant: env-pinned, else the first approved tenant.
  let tenant;
  if (process.env.GIFT_PACKAGING_TENANT_ID) {
    tenant = await Tenant.findById(process.env.GIFT_PACKAGING_TENANT_ID).lean();
    if (!tenant) throw new Error(`GIFT_PACKAGING_TENANT_ID ${process.env.GIFT_PACKAGING_TENANT_ID} does not exist`);
  } else {
    tenant = await Tenant.findOne({ status: 'approved' })
      .sort({ createdAt: 1 })
      .select('_id name revenueModel markupPercentage')
      .lean();
    if (!tenant) throw new Error('No approved tenant found — set GIFT_PACKAGING_TENANT_ID to designate one');
  }

  const revenueModel = tenant.revenueModel ?? 'markup';
  const markupPct = tenant.markupPercentage ?? 25;
  // Invert the forward chain so the customer pays exactly `price`:
  //   markup     → cost = price / (1 + markup%), size.platformMarkupOverridePct = 0
  //   commission → size.sellingPrice is the customer price (no platform markup)
  const costPrice = revenueModel === 'markup'
    ? Math.round((price / (1 + markupPct / 100)) * 100) / 100
    : 0;

  // ── Product (central catalog) ─────────────────────────────────────────────
  // Single source of truth: match on the flag first, then the name, so a
  // half-configured historic product is adopted rather than duplicated.
  let product = await Product.findOne({ $or: [{ isGiftPackaging: true }, { name: PRODUCT_NAME }] });
  if (!product) {
    product = await Product.create({
      name: PRODUCT_NAME,
      slug: SLUG,
      type: 'accessory',
      isAlcoholic: false,
      description: 'Paid gift packaging — decorative wrapping, ribbon and a handwritten gift note for your order.',
      isGiftPackaging: true,
      status: 'pending',
      isPublished: false,
      submissionSource: 'admin',
    });
    console.log(`Created Product ${product._id} — status 'pending': a super-admin must approve + publish it from the admin panel.`);
  } else {
    if (product.isGiftPackaging !== true) {
      product.isGiftPackaging = true;
      await product.save();
    }
    console.log(`Product ${product._id} already exists — isGiftPackaging ensured, status left as '${product.status}'.`);
  }

  // ── SubProduct (tenant-owned selling instance) ────────────────────────────
  let subProduct = await SubProduct.findOne({ product: product._id, tenant: tenant._id });
  if (!subProduct) {
    subProduct = await SubProduct.create({
      product: product._id,
      tenant: tenant._id,
      sku: SKU,
      baseSellingPrice: price,
      basePriceBeforePricelist: price,
      costPrice,
      status: 'active',
      isPublished: true,
      visibleInOnlineStore: true,
      availableStock: STOCK,
      totalStock: STOCK,
      description: 'Paid gift packaging for your DrinksHarbour order.',
    });
    console.log(`Created SubProduct ${subProduct._id} (sku ${SKU}) on tenant ${tenant.name || tenant._id}.`);
  } else {
    subProduct.baseSellingPrice = price;
    subProduct.basePriceBeforePricelist = price;
    subProduct.costPrice = costPrice;
    subProduct.status = 'active';
    subProduct.isPublished = true;
    subProduct.visibleInOnlineStore = true;
    await subProduct.save();
    console.log(`SubProduct ${subProduct._id} updated (price re-pinned to ₦${price.toLocaleString()}).`);
  }

  // ── Size (the priced unit the checkout pipeline reads) ────────────────────
  const sizeFields = {
    subproduct: subProduct._id,
    tenant: tenant._id,
    size: 'unit',
    displayName: 'Gift packaging',
    unitType: 'piece',
    sizeCategory: 'accessory',
    sellingPrice: price,
    costPrice,
    stock: STOCK,
    availableStock: STOCK,
    ...(revenueModel === 'markup' ? { platformMarkupOverridePct: 0 } : {}),
  };
  let size = await Size.findOne({ subproduct: subProduct._id });
  if (!size) {
    size = await Size.create(sizeFields);
    if (!subProduct.sizes?.some(s => String(s) === String(size._id))) {
      subProduct.sizes = [...(subProduct.sizes || []), size._id];
    }
    subProduct.defaultSize = size._id;
    await subProduct.save();
    console.log(`Created Size ${size._id} ('unit') priced at ₦${price.toLocaleString()}.`);
  } else {
    size.set(sizeFields);
    await size.save();
    console.log(`Size ${size._id} updated (price re-pinned to ₦${price.toLocaleString()}).`);
  }

  console.log('\n── Gift packaging seed summary ─────────────────────────');
  console.log(`  Product:    ${product._id} (${PRODUCT_NAME}, status: ${product.status})`);
  console.log(`  SubProduct: ${subProduct._id} (sku ${SKU}, tenant ${tenant.name || tenant._id}, model: ${revenueModel})`);
  console.log(`  Size:       ${size._id} — customer price ₦${price.toLocaleString()}`);
  console.log(`  Env pins:   GIFT_PACKAGING_TENANT_ID=${process.env.GIFT_PACKAGING_TENANT_ID || '(unset — first approved tenant)'}`);
  console.log('\nDeployment step: a super-admin must approve + publish the Product from the admin panel before the packaging checkbox goes live on the storefront.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
