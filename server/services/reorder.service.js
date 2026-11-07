// services/reorder.service.js

const mongoose = require('mongoose');
const ReorderRule = require('../models/ReorderRule');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const WarehouseStock = require('../models/WarehouseStock');
const { NotFoundError, ValidationError } = require('../utils/errors');

const { ObjectId } = mongoose.Types;

/**
 * Create a new reorder rule
 */
const createRule = async (data, userId, tenantId) => {
  const {
    subProductId,
    productId,
    sizeId,
    warehouseId,
    name,
    description,
    triggerType = 'reorder_point',
    minQuantity,
    reorderPoint,
    daysOfStock,
    forecastDays,
    quantityType = 'fixed',
    orderQuantity,
    maxStockLevel,
    daysOfSupply,
    preferredVendor,
    vendorName,
    leadTimeDays,
    unitCost,
    minimumOrderQuantity,
    isAutomatic = false,
    autoCreatePurchaseOrder = false,
    autoApprove = false,
    notifyOnTrigger = true,
    notifyEmails = [],
    checkFrequency = 'daily',
    notes,
    tags,
  } = data;

  if (!subProductId) {
    throw new ValidationError('SubProduct ID is required');
  }
  if (!name) {
    throw new ValidationError('Rule name is required');
  }

  // Verify subproduct exists and belongs to tenant
  const subProduct = await SubProduct.findOne({
    _id: subProductId,
    tenant: tenantId,
  });

  if (!subProduct) {
    throw new NotFoundError('SubProduct not found');
  }

  // Calculate next check time based on frequency
  const now = new Date();
  let nextCheckAt;
  switch (checkFrequency) {
    case 'realtime':
      nextCheckAt = now;
      break;
    case 'hourly':
      nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
      break;
    case 'weekly':
      nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'daily':
    default:
      nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const rule = await ReorderRule.create({
    tenant: tenantId,
    subProduct: subProductId,
    product: productId || subProduct.product,
    size: sizeId,
    warehouse: warehouseId,
    name,
    description,
    triggerType,
    minQuantity: minQuantity ?? subProduct.lowStockThreshold,
    reorderPoint: reorderPoint ?? subProduct.reorderPoint,
    daysOfStock,
    forecastDays,
    quantityType,
    orderQuantity: orderQuantity ?? subProduct.reorderQuantity,
    maxStockLevel,
    daysOfSupply,
    preferredVendor,
    vendorName,
    leadTimeDays: leadTimeDays ?? subProduct.leadTimeDays,
    unitCost: unitCost ?? subProduct.costPrice,
    minimumOrderQuantity: minimumOrderQuantity ?? subProduct.minimumOrderQuantity,
    isAutomatic,
    autoCreatePurchaseOrder,
    autoApprove,
    notifyOnTrigger,
    notifyEmails,
    checkFrequency,
    nextCheckAt,
    status: 'active',
    isActive: true,
    createdBy: userId,
    notes,
    tags,
  });

  console.log(`✅ Reorder rule created: ${name} for subProduct ${subProductId}`);
  return rule;
};

/**
 * Get all reorder rules for a tenant
 */
const getRules = async (tenantId, options = {}) => {
  const {
    subProductId,
    status,
    isActive,
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const query = { tenant: tenantId };

  if (subProductId) query.subProduct = subProductId;
  if (status) query.status = status;
  if (isActive !== undefined) query.isActive = isActive;

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [rules, total] = await Promise.all([
    ReorderRule.find(query)
      .populate('subProduct', 'sku totalStock availableStock lowStockThreshold reorderPoint reorderQuantity')
      .populate('product', 'name slug')
      // DRI-33 — rules UI cannot show the targeted Size without it. Identity
      // rides along verbatim (DRI-29 populate mirror). Sizeless rules carry no
      // populated Size — their payload keeps its exact pre-change shape.
      .populate('size', 'displayName size colorName colorHexCode optionName')
      .populate('warehouse', 'location')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    ReorderRule.countDocuments(query),
  ]);

  return {
    rules,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get a single reorder rule by ID
 */
const getRuleById = async (ruleId, tenantId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  })
    .populate('subProduct', 'sku totalStock availableStock lowStockThreshold reorderPoint reorderQuantity salesVelocity')
    .populate('product', 'name slug images')
    // DRI-33 — identity-aware single-rule view (emit-only-with-identity, same
    // populate mirror as getRules).
    .populate('size', 'displayName size colorName colorHexCode optionName')
    .populate('warehouse', 'location zone aisle')
    .populate('createdBy', 'name email')
    .lean();

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  return rule;
};

/**
 * Update a reorder rule
 */
const updateRule = async (ruleId, data, tenantId, userId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  });

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  const allowedFields = [
    'name',
    'description',
    'triggerType',
    'minQuantity',
    'reorderPoint',
    'daysOfStock',
    'forecastDays',
    'quantityType',
    'orderQuantity',
    'maxStockLevel',
    'daysOfSupply',
    'preferredVendor',
    'vendorName',
    'leadTimeDays',
    'unitCost',
    'minimumOrderQuantity',
    'isAutomatic',
    'autoCreatePurchaseOrder',
    'autoApprove',
    'notifyOnTrigger',
    'notifyEmails',
    'checkFrequency',
    'status',
    'isActive',
    'notes',
    'tags',
  ];

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      rule[field] = data[field];
    }
  });

  rule.updatedBy = userId;

  // Recalculate next check time if frequency changed
  if (data.checkFrequency) {
    const now = new Date();
    switch (data.checkFrequency) {
      case 'realtime':
        rule.nextCheckAt = now;
        break;
      case 'hourly':
        rule.nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'weekly':
        rule.nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'daily':
      default:
        rule.nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  await rule.save();

  console.log(`✅ Reorder rule updated: ${rule.name}`);
  return rule;
};

/**
 * Delete a reorder rule
 */
const deleteRule = async (ruleId, tenantId) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  });

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  await ReorderRule.findByIdAndDelete(ruleId);

  console.log(`✅ Reorder rule deleted: ${rule.name}`);
  return { success: true, message: 'Reorder rule deleted successfully' };
};

/**
 * DRI-33 — per-Size current-stock evaluation for the rules engine.
 *
 * Size-scoped rules (rule.size set) read the on-hand of that EXACT Size row:
 * WarehouseStock (currentQuantity - reservedQuantity), clamped per row exactly
 * like the availableQuantity virtual, summed over the rule's warehouse scope
 * (rule.warehouse set → that warehouse only; unset → every warehouse). When no
 * WarehouseStock row exists for the exact Size, the persisted per-Size
 * availableStock is the degraded on-hand source — the subProduct aggregate is
 * never read for a size-scoped rule.
 *
 * Sizeless rules keep the subProduct aggregate read BIT-IDENTICAL to the
 * pre-change engine (recorded decision: legacy beverage volume/pack rules
 * never change behaviour, and no extra query runs for them).Sales velocity
 * stays at subProduct level — per-Size velocity is not part of this contract
 * and is stated as coarse in the delivery evidence.
 */
async function ruleCurrentStock(rule, tenantId) {
  if (!rule.size) {
    const sp = rule.subProduct;
    return (sp && (sp.availableStock || sp.totalStock)) || 0;
  }

  const wsQuery = {
    tenant: tenantId,
    subProduct: (rule.subProduct && rule.subProduct._id) || rule.subProduct,
    size: rule.size,
  };
  if (rule.warehouse) wsQuery.warehouse = rule.warehouse;

  const rows = await WarehouseStock.find(wsQuery)
    .select('currentQuantity reservedQuantity')
    .lean();
  if (rows.length > 0) {
    return rows.reduce(
      (sum, row) =>
        sum +
        Math.max(0, (row.currentQuantity || 0) - (row.reservedQuantity || 0)),
      0
    );
  }
  // No WarehouseStock row for this exact Size — degrade to the persisted
  // per-Size figure (tenant-scoped lookup, per Workstream B).
  const size = await Size.findOne({ _id: rule.size, tenant: tenantId })
    .select('availableStock')
    .lean();
  return (size && size.availableStock) || 0;
}

/**
 * Check and trigger rules for a tenant
 */
const checkRules = async (tenantId) => {
  const dueRules = await ReorderRule.findDueForCheck(tenantId);
  const results = [];

  for (const rule of dueRules) {
    const subProduct = rule.subProduct;
    if (!subProduct) continue;

    const currentStock = await ruleCurrentStock(rule, tenantId);
    const salesVelocity = subProduct.salesVelocity || 0;

    const shouldTrigger = rule.checkTrigger(currentStock, salesVelocity);

    if (shouldTrigger) {
      const orderQuantity = rule.calculateOrderQuantity(currentStock, salesVelocity);

      // Trigger the rule
      await rule.trigger(currentStock, orderQuantity, 'Auto-triggered by scheduler');

      results.push({
        ruleId: rule._id,
        ruleName: rule.name,
        subProductId: subProduct._id,
        sku: subProduct.sku,
        currentStock,
        orderQuantity,
        triggered: true,
      });

      // TODO: If autoCreatePurchaseOrder is true, create a purchase order
      // TODO: If notifyOnTrigger is true, send notifications
    }

    // Update next check time
    const now = new Date();
    switch (rule.checkFrequency) {
      case 'realtime':
        rule.nextCheckAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
        break;
      case 'hourly':
        rule.nextCheckAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'weekly':
        rule.nextCheckAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'daily':
      default:
        rule.nextCheckAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    rule.lastCheckedAt = now;
    await rule.save();
  }

  return results;
};

/**
 * Manually trigger a rule
 */
const triggerRule = async (ruleId, tenantId, userId, notes) => {
  const rule = await ReorderRule.findOne({
    _id: ruleId,
    tenant: tenantId,
  }).populate('subProduct', 'sku totalStock availableStock salesVelocity');

  if (!rule) {
    throw new NotFoundError('Reorder rule not found');
  }

  const subProduct = rule.subProduct;
  const currentStock = await ruleCurrentStock(rule, tenantId);
  const salesVelocity = subProduct?.salesVelocity || 0;
  const orderQuantity = rule.calculateOrderQuantity(currentStock, salesVelocity);

  await rule.trigger(currentStock, orderQuantity, notes || 'Manually triggered');

  console.log(`✅ Reorder rule manually triggered: ${rule.name}`);

  return {
    rule,
    currentStock,
    orderQuantity,
    triggered: true,
  };
};

/**
 * DRI-33 — per-variant reorder suggestions.
 *
 * The pre-change engine was SubProduct-aggregate only: one suggestion per
 * subProduct built from its stored availableStock/reorderPoint, with no per
 * Size row and no Size identity — so a subProduct's EMERALD and IVORY variants
 * (and a beverage's 750ml and Case-of-6 rows) collapsed into a single line the
 * PO-raising handoff could not aim at an exact Size. That aggregate read is now
 * the SIZELESS fallback: subProducts without size rows keep the pre-change
 * mapping byte-identical (same query, same formulas, same key order). SubProducts
 * WITH size rows are expanded to one suggestion per exact Size row:
 *   • currentStock = Σ over the tenant's WarehouseStock rows for that exact
 *     Size of (currentQuantity - reservedQuantity), clamped per row like the
 *     availableQuantity virtual (across every warehouse);
 *   • reorderPoint / reorderQuantity / cost come off the Size row when the
 *     Size carries them, falling back to the subProduct fields exactly as the
 *     aggregate engine did;
 *   • urgency/suggestedQuantity reuse the pre-change formulas, recomputed per
 *     variant;
 *   • sizeId + size + displayName + verbatim colorName/colorHexCode/optionName
 *     ride along so the /purchases verified PO pickers (DRI-14 size-identity)
 *     receive exact Size rows — emit-only-with-identity, sizeless beverages
 *     keep the current aggregation shape byte-identical, and identity-less
 *     Size rows (colourless beverage volume/pack) carry no identity keys.
 *
 * Variants are gated per-variant with the same predicate the aggregate query
 * used (on-hand <= reorder point). A size-row subProduct whose aggregate no
 * longer describes any variant (e.g. stock drifted to per-Size WarehouseStock
 * rows while the stored aggregate stayed high) is caught by the bounded
 * catch-up scan below, so "what to buy right now" is per-variant everywhere.
 *
 * subProducts with size rows but NO WarehouseStock rows at all keep the legacy
 * aggregate representation — there is no per-Size on-hand to recompute from.
 */
const SUGGESTION_SCAN_LIMIT = 50;
const CATCH_UP_SCAN_LIMIT = 200;

function legacySuggestionRow(sp) {
  // Byte-identical to the pre-change mapping — keys, order and formulas.
  return {
    subProductId: sp._id,
    sku: sp.sku,
    product: sp.product,
    currentStock: sp.availableStock || 0,
    reorderPoint: sp.reorderPoint || 10,
    reorderQuantity: sp.reorderQuantity || 50,
    suggestedQuantity: Math.max(
      sp.reorderQuantity || 50,
      (sp.reorderPoint || 10) * 2 - (sp.availableStock || 0)
    ),
    leadTimeDays: sp.leadTimeDays || 7,
    unitCost: sp.costPrice || 0,
    estimatedCost: (sp.costPrice || 0) * (sp.reorderQuantity || 50),
    urgency:
      sp.availableStock <= 0
        ? 'critical'
        : sp.availableStock <= (sp.reorderPoint || 10) / 2
        ? 'high'
        : 'normal',
  };
}

function variantSuggestionRow(sp, sz, onHand) {
  const reorderPoint =
    (sz.reorderLevel ?? 0) > 0 ? sz.reorderLevel : sp.reorderPoint || 10;
  const reorderQuantity =
    (sz.reorderQuantity ?? 0) > 0 ? sz.reorderQuantity : sp.reorderQuantity || 50;
  const unitCost = (sz.costPrice ?? sp.costPrice) || 0;
  return {
    subProductId: sp._id,
    sizeId: sz._id,
    sku: sp.sku,
    product: sp.product,
    size: sz.size,
    displayName: sz.displayName,
    // Emit-only-with-identity — identity keys exist only when the Size
    // actually carries them (DRI-14/DRI-16 conditional-spread precedent).
    ...(sz.colorName ? { colorName: sz.colorName } : {}),
    ...(sz.colorHexCode ? { colorHexCode: sz.colorHexCode } : {}),
    ...(sz.optionName ? { optionName: sz.optionName } : {}),
    // PO-picker handoff consumables (DRI-14 pickers read unitType/unitsPerPack
    // off the Size row for the packaging default).
    ...(sz.unitType ? { unitType: sz.unitType } : {}),
    ...(sz.unitsPerPack > 1 ? { unitsPerPack: sz.unitsPerPack } : {}),
    currentStock: onHand,
    reorderPoint,
    reorderQuantity,
    suggestedQuantity: Math.max(reorderQuantity, reorderPoint * 2 - onHand),
    leadTimeDays: sp.leadTimeDays || 7,
    unitCost,
    estimatedCost: unitCost * reorderQuantity,
    urgency:
      onHand <= 0 ? 'critical' : onHand <= reorderPoint / 2 ? 'high' : 'normal',
  };
}

// Per subProduct context: its own Size docs (in subProduct.sizes order, stale
// references skipped) and per-Size on-hand summed from WarehouseStock.
async function variantStockContexts(tenantId, subProductIds) {
  const ids = subProductIds.map((id) => new ObjectId(String(id)));
  if (ids.length === 0) return new Map();

  const [sizes, stockRows] = await Promise.all([
    Size.find({ tenant: tenantId, subproduct: { $in: ids } })
      .select(
        '_id subproduct size displayName colorName colorHexCode optionName unitType unitsPerPack costPrice reorderLevel reorderQuantity'
      )
      .lean(),
    WarehouseStock.find({ tenant: tenantId, subProduct: { $in: ids } })
      .select('subProduct size currentQuantity reservedQuantity')
      .lean(),
  ]);

  const sizesBySub = new Map();
  for (const sz of sizes) {
    const key = String(sz.subproduct);
    if (!sizesBySub.has(key)) sizesBySub.set(key, new Map());
    sizesBySub.get(key).set(String(sz._id), sz);
  }
  const onHandBySize = new Map();
  const subsWithStock = new Set();
  for (const r of stockRows) {
    subsWithStock.add(String(r.subProduct));
    const onHand = Math.max(
      0,
      (r.currentQuantity || 0) - (r.reservedQuantity || 0)
    );
    const key = String(r.size);
    onHandBySize.set(key, (onHandBySize.get(key) || 0) + onHand);
  }

  return { sizesBySub, onHandBySize, subsWithStock };
}

function suggestionRowsForSub(sp, ctx, { fallBackToAggregate = false } = {}) {
  const subSizeMap = ctx.sizesBySub.get(String(sp._id)) || new Map();
  // sp.sizes order preserved; stale Size references skipped.
  const subSizes = (sp.sizes || [])
    .map((id) => subSizeMap.get(String(id)))
    .filter(Boolean);

  // No usable size rows (or no WarehouseStock at all → no per-Size on-hand to
  // recompute from): keep the legacy aggregate representation.
  if (subSizes.length === 0 || !ctx.subsWithStock.has(String(sp._id))) {
    return fallBackToAggregate ? [legacySuggestionRow(sp)] : [];
  }

  const rows = [];
  for (const sz of subSizes) {
    const onHand = ctx.onHandBySize.get(String(sz._id)) || 0;
    const reorderPoint =
      (sz.reorderLevel ?? 0) > 0 ? sz.reorderLevel : sp.reorderPoint || 10;
    // Same per-variant gate the aggregate query applied at subProduct level.
    if (onHand <= reorderPoint) rows.push(variantSuggestionRow(sp, sz, onHand));
  }
  if (rows.length === 0) {
    // Aggregate tripped the ledger but no variant breaches its own threshold —
    // keep the legacy aggregate representation rather than emitting nothing.
    return fallBackToAggregate ? [legacySuggestionRow(sp)] : [];
  }
  // Worst first — the most urgent variant line leads.
  return rows.sort((a, b) => a.currentStock - b.currentStock);
}

const getReorderSuggestions = async (tenantId) => {
  // Threshold row: the EXACT pre-change aggregate query — untouched, so the
  // sizeless fallback rows keep their byte-identical list semantics.
  const subProducts = await SubProduct.find({
    tenant: tenantId,
    status: { $nin: ['archived', 'discontinued'] },
    $expr: { $lte: ['$availableStock', '$reorderPoint'] },
  })
    .populate('product', 'name slug images')
    .sort({ availableStock: 1 })
    .limit(SUGGESTION_SCAN_LIMIT)
    .lean();

  const matchedIds = subProducts.map((sp) => sp._id);
  const ctx = await variantStockContexts(
    tenantId,
    subProducts.filter((sp) => (sp.sizes || []).length > 0).map((sp) => sp._id)
  );

  const rows = [];
  for (const sp of subProducts) {
    if ((sp.sizes || []).length > 0) {
      rows.push(...suggestionRowsForSub(sp, ctx, { fallBackToAggregate: true }));
    } else {
      rows.push(legacySuggestionRow(sp));
    }
  }

  // Catch-up: size-row subProducts whose stored aggregate no longer describes
  // their variants sit outside the aggregate gate above and would have been
  // invisible to the pre-change engine. Bounded scan (200) — the surface is
  // "what to buy right now", not a batching drain; the cap scales with the
  // same magnitude as the pre-change 50-subProduct page.
  const catchUp = await SubProduct.find({
    tenant: tenantId,
    status: { $nin: ['archived', 'discontinued'] },
    _id: { $nin: matchedIds },
    'sizes.0': { $exists: true },
  })
    .populate('product', 'name slug images')
    .sort({ availableStock: 1 })
    .limit(CATCH_UP_SCAN_LIMIT)
    .lean();

  const catchUpIds = catchUp.map((sp) => sp._id);
  const catchUpCtx = await variantStockContexts(tenantId, catchUpIds);
  const catchUpRows = [];
  for (const sp of catchUp) {
    const subRows = suggestionRowsForSub(sp, catchUpCtx);
    if (subRows.length > 0) catchUpRows.push(subRows);
  }

  // Deterministic order: candidates whose most-urgent variant needs attention
  // first (min on-hand asc), then each sub's variant rows worst-first.
  catchUpRows.sort(
    (a, b) => a[0].currentStock - b[0].currentStock
  );
  rows.push(...catchUpRows.flat());

  return rows;
};

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  checkRules,
  triggerRule,
  getReorderSuggestions,
};
