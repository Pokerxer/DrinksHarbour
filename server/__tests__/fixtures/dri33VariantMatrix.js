'use strict';
// DRI-33 — shared variant matrix for the new /inventory ten-surface backend
// fixtures (board scope extension #9: customer-returns identity, per-variant
// reorder engine, rules Size populate + per-Size evaluation).
//
// The tenant matrix is the DRI-16/DRI-32 7-industry flavour matrix (its
// canonical copy lives in server/__tests__/inventoryMovementsRetailTypes.mongo
// .mongo.test.js, which keeps its own byte-stable local copy): five retail
// businessTypes (Fashion lead), one profiled beverage tenant ('Wine Merchant'
// → ['beverage'], colourless volume/pack rows), one hospitality/food-service
// tenant ('Restaurant' → ['food-service','hospitality','beverage'], two
// same-size portion rows), plus one unprofiled legacy beverage control. No
// per-industry forks — the seeding code is industry-agnostic by design and
// every flavour flows through the same shapes.
//
// Functions are seeding-only infrastructure: no production behaviour changes.

const mongoose = require('mongoose');

const RETAIL_TYPES = [
  {
    key: 'fashion', businessType: 'Fashion Retail',
    productType: 'fashion_dress', productName: 'Skyline Ankara Gown',
    sku: 'INV-GOWN', baseBarcode: 'INV-SKY', variantBase: 'Gown',
    size: 'M', unitType: 'piece', currency: 'NGN', unitCost: 100,
    variants: [
      { colorName: 'Emerald', colorHexCode: '#50C878', optionName: 'Emerald gown', suffix: '-A' },
      { colorName: 'Ivory', colorHexCode: '#FFFFF0', optionName: 'Ivory gown', suffix: '-B' },
    ],
  },
  {
    key: 'electronics', businessType: 'Electronics Retail',
    productType: 'electronics_audio', productName: 'Nova Bluetooth Speaker',
    sku: 'INV-SPK', baseBarcode: 'INV-ELEC', variantBase: 'Speaker',
    size: 'one', unitType: 'count_unit', currency: 'USD', unitCost: 20,
    variants: [
      { optionName: 'Graphite speaker', suffix: '-A' },
      { optionName: 'Sand speaker', suffix: '-B' },
    ],
  },
  {
    key: 'beauty', businessType: 'Beauty & Skincare',
    productType: 'beauty_skincare', productName: 'Glow Shea Body Oil',
    sku: 'INV-OIL', baseBarcode: 'INV-SKN', variantBase: 'Oil blend',
    size: '200ml', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Rose blend', suffix: '-A' },
      { optionName: 'Unscented blend', suffix: '-B' },
    ],
  },
  {
    key: 'home', businessType: 'Home & Living',
    productType: 'home_kitchen', productName: 'Hearth Ceramic Kettle',
    sku: 'INV-KET', baseBarcode: 'INV-HOME', variantBase: 'Kettle glaze',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Sage glaze', suffix: '-A' },
      { optionName: 'Terracotta glaze', suffix: '-B' },
    ],
  },
  {
    key: 'general', businessType: 'General Retail',
    productType: 'gift_set', productName: 'Harbour Gift Hamper',
    sku: 'INV-BOX', baseBarcode: 'INV-GEN', variantBase: 'Hamper wrap',
    size: 'one', unitType: 'count_unit', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Red-ribbon hamper', suffix: '-A' },
      { optionName: 'Gold-ribbon hamper', suffix: '-B' },
    ],
  },
  // Profiled beverage flavour — colourless volume/pack rows (the
  // identity-free shape the legacy control stores, on volume/pack unitTypes).
  {
    key: 'beverage', businessType: 'Wine Merchant', flavour: 'beverage',
    productType: 'wine', productName: 'Harbour Cabernet Sauvignon',
    sku: 'INV-WINE', baseBarcode: 'INV-CAB',
    unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
    volumeSizes: [
      { size: '750ml', displayName: 'Harbour Cabernet Sauvignon 750ml',
        unitType: 'volume_ml', volumeMl: 750, sellingPrice: 250, suffix: '-A' },
      { size: 'Case of 6', displayName: 'Harbour Cabernet Sauvignon Case of 6',
        unitType: 'count_case', volumeMl: 4500, sellingPrice: 1200, suffix: '-B' },
    ],
  },
  // Hospitality/food-service flavour — two SAME-size portion rows
  // distinguished by optionName identity only (unitType 'serving').
  {
    key: 'restaurant', businessType: 'Restaurant', flavour: 'restaurant',
    productType: 'foodservice_staples', productName: 'Harbour Kitchen Rice Plate',
    sku: 'INV-PLATE', baseBarcode: 'INV-RICE', variantBase: 'Regular plate',
    size: 'Regular plate', unitType: 'serving', currency: 'NGN', unitCost: 100,
    variants: [
      { optionName: 'Jollof portion', suffix: '-A' },
      { optionName: 'Goat portion', suffix: '-B' },
    ],
  },
];

const LEGACY_DEF = {
  key: 'legacy', businessType: 'Legacy Beverage',
  productType: 'beer', productName: 'Legacy Lager',
  sku: 'INV-LAG', baseBarcode: 'INV-LAG', displayName: 'Legacy Lager 750ml',
  size: '750ml', unitType: 'volume_ml', currency: 'NGN', unitCost: 100,
};

function sizeVariantLabel(size) {
  return [size.displayName ?? size.size, size.colorName, size.optionName]
    .filter(Boolean)
    .join(' · ');
}

const oid = () => new mongoose.Types.ObjectId();

/**
 * Tenant base: tenant (plan-driven, businessType set), TWO warehouses, an
 * admin user, one central Product. Returns ids only — sub/sizes are seeded
 * per test needs through seedVariantsSubProduct below.
 */
async function seedTenantBase(def, { plan = 'growth', warehouses = 2 } = {}) {
  const Tenant = require('../../models/Tenant');
  const Warehouse = require('../../models/Warehouse');
  const Product = require('../../models/Product');

  const tenantId = oid(), adminId = oid();
  const warehouseIds = [];

  await Tenant.collection.insertOne({
    _id: tenantId, status: 'approved', isActive: true,
    plan, subscriptionStatus: 'active', businessType: def.businessType,
    name: `${def.key} DRI33`,
  });
  for (let i = 0; i < warehouses; i++) {
    const wid = oid();
    await Warehouse.create({
      _id: wid, tenant: tenantId,
      name: `${def.key} warehouse ${i}`,
      code: `D33-${def.key.toUpperCase()}-${i}`,
      isActive: true, isDefault: i === 0,
    });
    warehouseIds.push(String(wid));
  }
  await require('../../models/User').collection.insertOne({
    _id: adminId, tenant: tenantId, role: 'tenant_admin', status: 'active',
    firstName: def.key, lastName: 'DRI33',
  });

  const product = await Product.collection.insertOne({
    name: def.productName, type: def.productType,
    isAlcoholic: def.key === 'legacy', tracksBatch: false,
  });

  return {
    def, tenantId: String(tenantId), adminId: String(adminId),
    warehouseIds, productId: String(product.insertedId),
  };
}

/**
 * One SubProduct with per-flavour Size rows + optional WarehouseStock rows.
 *
 * `metrics`     — { availableStock, reorderPoint, reorderQuantity, costPrice,
 *                  leadTimeDays } stored on the SubProduct (aggregate fields).
 * `stock`       — optional array (per variant index) of arrays of
 *                  { warehouseIndex, currentQuantity, reservedQuantity }.
 * `sizeOpts`    — optional per-variant-index { reorderLevel, reorderQuantity,
 *                  costPrice } written onto the Size docs.
 */
async function seedVariantsSubProduct(def, base, {
  metrics = {}, stock = null, sizeOpts = {}, legacy = false,
} = {}) {
  const SubProduct = require('../../models/SubProduct');
  const Size = require('../../models/Size');
  const WarehouseStock = require('../../models/WarehouseStock');

  const tenantId = new mongoose.Types.ObjectId(String(base.tenantId));
  const subId = oid();

  await SubProduct.collection.insertOne({
    _id: subId, tenant: tenantId, product: new mongoose.Types.ObjectId(String(base.productId)),
    status: 'active', visibleInPOS: true, sku: def.sku,
    baseSellingPrice: legacy ? 1000 : 250,
    costPrice: metrics.costPrice ?? def.unitCost,
    ...(metrics.availableStock !== undefined ? { availableStock: metrics.availableStock } : {}),
    ...(metrics.reorderPoint !== undefined ? { reorderPoint: metrics.reorderPoint } : {}),
    ...(metrics.reorderQuantity !== undefined ? { reorderQuantity: metrics.reorderQuantity } : {}),
    ...(metrics.leadTimeDays !== undefined ? { leadTimeDays: metrics.leadTimeDays } : {}),
    ...(metrics.lowStockThreshold !== undefined ? { lowStockThreshold: metrics.lowStockThreshold } : {}),
  });

  const sizes = [];
  const insertOne = async ({ doc, row }) => {
    const sizeId = oid();
    await Size.collection.insertOne({ _id: sizeId, tenant: tenantId, subproduct: subId, ...doc });
    sizes.push({ _id: String(sizeId), ...row });
  };

  const opt = (i) => sizeOpts[i] || {};

  if (legacy) {
    await insertOne({
      doc: {
        displayName: def.displayName, size: def.size, volumeMl: 750,
        unitType: def.unitType, sellingPrice: 1000, costPrice: def.unitCost,
        sku: `${def.sku}-A`,
      },
      row: { size: def.size, displayName: def.displayName },
    });
  } else if (def.flavour === 'beverage') {
    for (const v of def.volumeSizes) {
      await insertOne({
        doc: {
          displayName: v.displayName, size: v.size, volumeMl: v.volumeMl,
          unitType: v.unitType, sellingPrice: v.sellingPrice, costPrice: def.unitCost,
          sku: `${def.sku}${v.suffix}`, barcode: `${def.baseBarcode}${v.suffix}`,
        },
        row: { size: v.size, displayName: v.displayName, unitType: v.unitType,
          colorName: null, colorHexCode: null, optionName: null },
      });
    }
  } else if (def.flavour === 'restaurant') {
    for (const variant of def.variants) {
      const composed = sizeVariantLabel({ displayName: def.size, optionName: variant.optionName });
      await insertOne({
        doc: {
          displayName: composed, size: def.size, optionName: variant.optionName,
          unitType: def.unitType, sellingPrice: 250, costPrice: def.unitCost,
          sku: `${def.sku}${variant.suffix}`, barcode: `${def.baseBarcode}${variant.suffix}`,
        },
        row: { size: def.size, displayName: composed,
          colorName: null, colorHexCode: null, optionName: variant.optionName ?? null },
      });
    }
  } else {
    for (const variant of def.variants) {
      const composed = sizeVariantLabel({
        displayName: `${def.variantBase} — ${variant.colorName ?? variant.optionName}`,
        colorName: variant.colorName, optionName: variant.optionName,
      });
      await insertOne({
        doc: {
          displayName: composed, size: def.size,
          ...(variant.colorName
            ? { colorName: variant.colorName, colorHexCode: variant.colorHexCode, optionName: variant.optionName }
            : { optionName: variant.optionName }),
          unitType: def.unitType, sellingPrice: 250, costPrice: def.unitCost,
          sku: `${def.sku}${variant.suffix}`, barcode: `${def.baseBarcode}${variant.suffix}`,
        },
        row: { size: def.size, displayName: composed,
          colorName: variant.colorName ?? null,
          colorHexCode: variant.colorHexCode ?? null,
          optionName: variant.optionName ?? null },
      });
    }
  }

  // Per-variant Size opts written outside the docs above so reorderLevel /
  // reorderQuantity overrides stay explicit and shared across flavours.
  await Promise.all(sizes.map(async (s, i) => {
    const o = opt(i);
    const patch = {};
    if (o.reorderLevel !== undefined) patch.reorderLevel = o.reorderLevel;
    if (o.reorderQuantity !== undefined) patch.reorderQuantity = o.reorderQuantity;
    if (Object.keys(patch).length) {
      await Size.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(s._id) }, { $set: patch });
    }
  }));

  // The fixture rows carry each Size's stored unitType for the PO-picker
  // handoff assertions (beverage rows: volume_ml vs count_case, distinct per
  // row); restaurant/retail rows use the flavour-level unitType set at seed
  // time.
  const defUnitType = def.unitType;
  for (const s of sizes) {
    if (!s.unitType) s.unitType = defUnitType;
  }

  await SubProduct.collection.updateOne(
    { _id: subId },
    { $set: { defaultSize: sizes[0]._id, sizes: sizes.map((s) => s._id) } }
  );

  if (stock) {
    for (let i = 0; i < sizes.length; i++) {
      for (const row of stock[i] || []) {
        await WarehouseStock.create({
          tenant: tenantId,
          warehouse: new mongoose.Types.ObjectId(String(base.warehouseIds[row.warehouseIndex])),
          subProduct: subId,
          size: new mongoose.Types.ObjectId(String(sizes[i]._id)),
          currentQuantity: row.currentQuantity ?? 0,
          reservedQuantity: row.reservedQuantity ?? 0,
        });
      }
    }
  }

  return {
    subId: String(subId),
    sizes: sizes.map((s) => ({ ...s, _id: String(s._id) })),
  };
}

module.exports = {
  RETAIL_TYPES, LEGACY_DEF, sizeVariantLabel, seedTenantBase, seedVariantsSubProduct,
};
