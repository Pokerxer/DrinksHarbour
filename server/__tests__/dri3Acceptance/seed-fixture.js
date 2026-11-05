'use strict';
/**
 * DRI-3 browser acceptance fixture seed.
 *
 * RUN ONCE, outside node --test:
 *   cd server && DRISHARBOUR_DRI3_DROP=1 node __tests__/dri3Acceptance/seed-fixture.js
 *
 * All data is synthetic (fixture-only tenants, users, listings — no real
 * records). Database: drinks_dri3_browser on the shared disposable venuePhase0
 * replica ( mongod :29127 ). Dropped and reseeded by this script.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI =
  process.env.DRINKSHARBOUR_DRI3_MONGO_URI ||
  'mongodb://127.0.0.1:29127/drinks_dri3_browser?replicaSet=venuePhase0';

const PASSWORD = process.env.DRINKSHARBOUR_DRI3_PASSWORD || 'Dri3-Fixture-Pass!2026';
const oid = () => new mongoose.Types.ObjectId();

const TENANT_DEFS = [
  {
    key: 'fashion', name: 'Skyline Fashion House', slug: 'skyline-fashion',
    businessType: 'Fashion Retail',
  },
  {
    key: 'electronics', name: 'Nova Electronics Bay', slug: 'nova-electronics',
    businessType: 'Electronics Retail',
  },
  {
    key: 'beauty', name: 'Glow Beauty Bar', slug: 'glow-beauty',
    businessType: 'Beauty & Skincare',
  },
  {
    key: 'home', name: 'Hearth & Home Abuja', slug: 'hearth-home',
    businessType: 'Home & Living',
  },
  {
    key: 'general', name: 'Harbour General Store', slug: 'harbour-general',
    businessType: 'General Retail',
  },
];

async function main() {
  await mongoose.connect(MONGO_URI.replace('?', '?directConnection=true&'), {
    serverSelectionTimeoutMS: 10000,
  });
  const admin = mongoose.connection.db.admin();
  try { await admin.command({ replSetGetStatus: 1 }); }
  catch (error) {
    if (error.code !== 94) throw error;
    await admin.command({ replSetInitiate: { _id: 'venuePhase0', members: [{ _id: 0, host: '127.0.0.1:29127' }] } });
  }
  await mongoose.disconnect();
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  const db = mongoose.connection.db;
  await db.dropDatabase();
  const collections = await db.listCollections().toArray();
  console.log('Dropped drinks_dri3_browser (collections before seed:', collections.length + ')');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const Tenant = require('../../models/Tenant');
  const User = require('../../models/User');
  const Product = require('../../models/Product');
  const SubProduct = require('../../models/SubProduct');
  const Size = require('../../models/Size');
  const PlatformWalletTransaction = require('../../models/PlatformWalletTransaction');

  // ── 1. Tenants ───────────────────────────────────────────────────────────
  // Approved + active so the dashboards are usable; businessType is the only
  // profile input — industries resolve from it via resolveTenantIndustries.
  const tenants = {};
  for (const def of TENANT_DEFS) {
    const tenant = await Tenant.create({
      name: def.name,
      slug: def.slug,
      status: 'approved',
      isActive: true,
      plan: 'growth',
      subscriptionStatus: 'active',
      businessType: def.businessType,
      // industries deliberately unset — the resolution must derive them
      revenueModel: 'commission',
      commissionPercentage: 13,
      defaultCurrency: 'NGN',
      country: 'Nigeria',
      contactEmail: `owner@${def.slug}.test`,
      contactPhone: '+2348010000000',
    });
    tenants[def.key] = tenant;
  }

  // ── 2. Users ─────────────────────────────────────────────────────────────
  const superAdmin = await User.collection.insertOne({
    firstName: 'Fixture', lastName: 'Superadmin',
    email: 'superadmin@dri3-fixture.test', passwordHash,
    role: 'super_admin', status: 'active', isEmailVerified: true,
  });
  const users = {};
  for (const def of TENANT_DEFS) {
    const res = await User.collection.insertOne({
      firstName: def.key, lastName: 'Owner',
      email: `owner@${def.slug}.test`, passwordHash,
      role: 'tenant_owner', status: 'active', isEmailVerified: true,
      tenant: tenants[def.key]._id,
    });
    users[def.key] = res.insertedId;
  }
  // Storefront buyer — funded DH Wallet (platform-wide stored value). The
  // balance invariant pairs every platformWalletBalance mutation with an
  // appended PlatformWalletTransaction ledger row.
  const WALLET_FUNDING = 200000;
  const customer = await User.collection.insertOne({
    firstName: 'Buyer', lastName: 'Customer',
    email: 'buyer@dri3-fixture.test', passwordHash,
    role: 'customer', status: 'active', isEmailVerified: true, isAgeVerified: true,
    platformWalletBalance: WALLET_FUNDING,
  });
  await PlatformWalletTransaction.collection.insertOne({
    userId: customer.insertedId, type: 'credit', amount: WALLET_FUNDING,
    balanceAfter: WALLET_FUNDING, source: 'adjustment',
    reason: 'DRI-3 acceptance fixture opening balance',
  });

  // ── 3. Central catalog products (single source of truth) ─────────────────
  // Kinds follow constants/generalProductTypes.js retail verticals.
  const productDefs = [
    { key: 'fashion', name: 'Skyline Tailored Shirt', type: 'fashion_top', approved: true },
    { key: 'fashion2', name: 'Skyline Summer Dress', type: 'fashion_dress', approved: true },
    { key: 'electronics', name: 'Nova Phone Pro 128', type: 'electronics_phone', approved: true },
    { key: 'electronics2', name: 'Nova Tablet 11 256', type: 'electronics_tablet', approved: true },
    { key: 'beauty', name: 'Glow Night Serum 50ml', type: 'beauty_skincare', approved: true },
    { key: 'beauty2', name: 'Glow Vitamin Booster 20ml', type: 'beauty_skincare', approved: true },
    { key: 'beauty_private', name: 'Glow Secret Booster 20ml', type: 'beauty_skincare', approved: true },
    { key: 'home', name: 'Hearth Linen Cushion 45cm', type: 'home_decor', approved: true },
    { key: 'home2', name: 'Hearth Brass Table Lamp 30cm', type: 'home_lighting', approved: true },
    { key: 'general_beauty', name: 'Harbour Vitamin C Cream 30ml', type: 'beauty_skincare', approved: true },
    { key: 'general_fashion', name: 'Harbour Denim Jacket L', type: 'fashion_outerwear', approved: true },
    { key: 'pending_candle', name: 'Hearth Beacon Candle', type: 'home_decor', approved: false },
  ];
  const products = {};
  for (const def of productDefs) {
    const doc = await Product.collection.insertOne({
      name: def.name,
      slug: def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + def.key,
      type: def.type,
      status: def.approved ? 'approved' : 'pending',
      // SELLABLE_PRODUCT_MATCH requires isPublished on approved products; the
      // pending product stays unpublished (marketplace-eligibility boundary).
      isPublished: !!def.approved,
      isAlcoholic: false,
      isPublic: def.approved,
    });
    products[def.key] = doc.insertedId;
  }

  // ── 4. SubProducts + Size rows ────────────────────────────────────────────
  const out = { fixture: 'dri3_browser', password: PASSWORD, tenants: {}, products: {} };
  for (const def of TENANT_DEFS) {
    out.tenants[def.key] = {
      id: String(tenants[def.key]._id), slug: def.slug, name: def.name,
      businessType: def.businessType, ownerId: String(users[def.key]),
      ownerEmail: `owner@${def.slug}.test`,
    };
  }
  out.superadmin = { email: 'superadmin@dri3-fixture.test', id: String(superAdmin.insertedId) };
  out.customer = { email: 'buyer@dri3-fixture.test', id: String(customer.insertedId) };
  for (const def of productDefs) out.products[def.key] = String(products[def.key]);

  // Fashion — SAME apparel size, two colours: the same-size variant pair used
  // by storefront selection → two separate cart lines → checkout.
  {
    const subproduct = oid();
    const sizeEmerald = oid(); const sizeAmber = oid();
    const productId = products.fashion;
    await SubProduct.collection.insertOne({
      _id: subproduct, tenant: tenants.fashion._id, product: productId,
      sku: 'DRFASH-SHIRT-001', name: 'Skyline Tailored Shirt',
      status: 'active', isPublished: true, availability: true,
      sellingPrice: 22000, costPrice: 12000, stockQuantity: 12,
      availableStock: 12, reservedStock: 0, totalStock: 12,
      // Inline link matching the live model shape (SubProduct.sizes → Size);
      // getProductBySlug populates this array — without it the listing
      // is invisible ("not currently available from any seller").
      sizes: [sizeEmerald, sizeAmber],
      defaultSize: sizeEmerald,
    });
    await Size.collection.insertMany([
      { _id: sizeEmerald, tenant: tenants.fashion._id, subproduct, size: 'apparel', sizeLabel: 'size M', apparelSize: 'M', displayName: 'M · Emerald', colorName: 'Emerald Green', colorHexCode: '#046A38', sku: 'VAR-EMERALD-M', sellingPrice: 22000, costPrice: 12000, stockQuantity: 12, stock: 12, availableStock: 12, reservedStock: 0, status: 'active', availability: 'available', isDefault: true },
      { _id: sizeAmber, tenant: tenants.fashion._id, subproduct, size: 'apparel', sizeLabel: 'size M', apparelSize: 'M', displayName: 'M · Amber', colorName: 'Amber Gold', colorHexCode: '#FFBF00', sku: 'VAR-AMBER-M', sellingPrice: 24000, costPrice: 12000, stockQuantity: 5, stock: 5, availableStock: 5, reservedStock: 0, status: 'active', availability: 'available', isDefault: false },
    ]);
    out.variantPair = {
      tenant: 'fashion', product: String(productId), subProduct: String(subproduct),
      emerald: String(sizeEmerald), amber: String(sizeAmber),
    };
    // Private catalogue record — fashion tenant's unpublished sibling.
    // Private catalogue = unpublished in the online store, sellable only via
    // the tenant's own (POS/admin) surfaces.
    const privateSub = oid(); const privateSize = oid();
    await SubProduct.collection.insertOne({
      _id: privateSub, tenant: tenants.fashion._id, product: products.beauty_private,
      sku: 'DRFASH-SHIRT-002', name: 'Skyline Sample Shirt (internal)',
      status: 'active', isPublished: false, availability: true,
      visibleInOnlineStore: false,
      sellingPrice: 9000, costPrice: 5000, stockQuantity: 3,
      sizes: [privateSize],
      defaultSize: privateSize,
    });
    await Size.collection.insertOne({
      _id: privateSize, tenant: tenants.fashion._id, subproduct: privateSub,
      size: 'apparel', sizeLabel: 'size S', apparelSize: 'S',
      sellingPrice: 9000, costPrice: 5000, stockQuantity: 3, stock: 3, availableStock: 3, reservedStock: 0,
      status: 'active', availability: 'available',
    });
    out.privateSub = { tenant: 'fashion', id: String(privateSub), size: String(privateSize) };
  }

  // Other tenants each get one published, sellable listing
  const simpleDef = [
    { tenant: 'electronics', product: 'electronics', name: 'Nova Phone Pro 128', sub: 'DRNOVA-PHONE-001', price: 450000, cost: 300000, size: 'electronics' },
    { tenant: 'beauty', product: 'beauty', name: 'Glow Night Serum 50ml', sub: 'DRGLOW-SERUM-001', price: 15000, cost: 8000, size: 'standard' },
    { tenant: 'home', product: 'home', name: 'Hearth Linen Cushion 45cm', sub: 'DRHEARTH-CUSH-001', price: 14000, cost: 7500, size: 'standard' },
    { tenant: 'general', product: 'general_beauty', name: 'Harbour Vitamin C Cream 30ml', sub: 'DRGEN-CREAM-001', price: 9500, cost: 5000, size: 'standard' },
  ];
  for (const def of simpleDef) {
    const subproduct = oid(); const sizeId = oid();
    await SubProduct.collection.insertOne({
      _id: subproduct, tenant: tenants[def.tenant]._id, product: products[def.product],
      sku: def.sub, name: def.name,
      status: 'active', isPublished: true, availability: true,
      sellingPrice: def.price, costPrice: def.cost, stockQuantity: 8,
      availableStock: 8, reservedStock: 0, totalStock: 8,
      sizes: [sizeId],
      defaultSize: sizeId,
    });
    await Size.collection.insertOne({
      _id: sizeId, tenant: tenants[def.tenant]._id, subproduct,
      size: def.size, sizeLabel: 'standard', sellingPrice: def.price,
      costPrice: def.cost, stockQuantity: 8, stock: 8, availableStock: 8, reservedStock: 0,
      status: 'active', availability: 'available', isDefault: true,
    });
  }

  // Marketplace-eligibility boundary: a SubProduct on the PENDING product
  // (Hearth tenant) must not surface on collective marketplace surfaces.
  {
    const subproduct = oid(); const sizeId = oid();
    await SubProduct.collection.insertOne({
      _id: subproduct, tenant: tenants.home._id, product: products.pending_candle,
      sku: 'DRHEARTH-CAND-001', name: 'Hearth Beacon Candle',
      status: 'active', isPublished: true, availability: true,
      sellingPrice: 7000, costPrice: 3500, stockQuantity: 6,
      availableStock: 6, reservedStock: 0, totalStock: 6,
      sizes: [sizeId],
      defaultSize: sizeId,
    });
    await Size.collection.insertOne({
      _id: sizeId, tenant: tenants.home._id, subproduct,
      size: 'standard', sizeLabel: 'standard', sellingPrice: 7000,
      costPrice: 3500, stockQuantity: 6, stock: 6, availableStock: 6, reservedStock: 0,
      status: 'active', availability: 'available',
    });
    out.pendingProductSub = { tenant: 'home', subProduct: String(subproduct) };
  }

  // Highlights the seed summary for the operator/evidence doc.
  console.log('DRI-3 fixture seeded:');
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => { console.error(error); process.exit(1); });
