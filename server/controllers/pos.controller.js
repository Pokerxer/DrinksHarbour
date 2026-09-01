// controllers/pos.controller.js

const mongoose = require('mongoose');
const POSSession = require('../models/POSSession');
const Order = require('../models/Order');
const POSTable = require('../models/POSTable');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const Size            = require('../models/Size');
const SubProduct      = require('../models/SubProduct');
const Warehouse       = require('../models/Warehouse');
const WarehouseStock  = require('../models/WarehouseStock');
const { sellStock, returnStock, resolveShopWarehouse } = require('../services/warehouse.service');
const { getTenantWarehouseSettings } = require('./warehouse.controller');
const InventoryMovement = require('../models/InventoryMovement');
const SalesOrder = require('../models/SalesOrder');
const POSCustomer = require('../models/POSCustomer');
const WalletTransaction = require('../models/WalletTransaction');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const { mutateWallet } = require('../services/wallet.service');
const { mutateLoyalty } = require('../services/loyalty.service');
const { loyaltyDelta } = require('../services/contact.helpers');
const inventoryService = require('../services/inventory.service');
const { generateOrderNumber, generateReceiptNumber, generateReturnNumber } = require('../utils/orderUtils');
const { emitToTerminal, emitToKds } = require('../services/pos.realtime');
const { venueBlocked } = require('../services/posVenue.service');
const { calcPlatformCostPrice, calcPlatformSellingPrice, resolveRevenueRates, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
const {
  findMatchingPriceRules,
  applyPriceRules,
  pickBestBundle,
  applyBundleOverride,
  computeBundleLineDiscount,
  applyCartBundles,
  findCartThresholdRules,
  computeCartThresholdDiscount,
} = require('../services/pricelistPricing.service');

// ─── Stock helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the correct availability string from a stock count and threshold.
 */
function resolveAvailability(stock, lowStockThreshold = 6) {
  if (stock <= 0)                    return 'out_of_stock';
  if (stock <= lowStockThreshold)    return 'low_stock';
  return 'available';
}

/**
 * Resolve the SubProduct status from its availableStock.
 */
function resolveSubProductStatus(availableStock, lowStockThreshold = 10) {
  if (availableStock <= 0)                 return 'out_of_stock';
  if (availableStock <= lowStockThreshold) return 'low_stock';
  return 'active';
}

/**
 * Deduct stock for one order line (size-level or subproduct-level).
 * Returns the deducted Size/SubProduct document.
 * Creates an InventoryMovement audit record.
 * Throws if insufficient stock.
 */
async function deductStock({ subProductId, sizeId, quantity, tenantId, staffId, receiptNumber, productId, finalPrice, costPrice, allowOverselling = false, allowNegativeStock = false, warehouseId = null, defaultSizeId = null, tracksBatch = false, blockExpiredStock = false, fefoPicking = false }) {
  if (warehouseId) {
    // ── Warehouse-scoped deduction ────────────────────────────────────────
    // Decrement WarehouseStock directly; recalcSubProductStock refreshes the
    // SubProduct rollup, so the legacy $inc path below must NOT also run.
    const whSizeId = sizeId || defaultSizeId;
    const { before, after, batchAllocations } = await sellStock(
      { warehouseId, subProduct: subProductId, size: whSizeId, quantity, allowOverselling, allowNegativeStock, tracksBatch, blockExpiredStock, fefoPicking },
      staffId, tenantId
    );

    InventoryMovement.create({
      subProduct:     subProductId,
      tenant:         tenantId,
      warehouse:      warehouseId,
      product:        productId || undefined,
      size:           whSizeId || undefined,
      type:           'sold',
      category:       'out',
      quantity,
      quantityBefore: before,
      quantityAfter:  after,
      reference:      receiptNumber,
      referenceType:  'order',
      sellingPrice:   finalPrice,
      unitCost:       costPrice || 0,
      totalCost:      (costPrice || 0) * quantity,
      performedBy:    staffId || tenantId,
      performedAt:    new Date(),
      source:         'order',
      status:         'confirmed',
      notes:          `POS sale — receipt ${receiptNumber}`,
    }).catch(err => console.error('[Inventory] POS deductStock audit failed:', err.message));

    return { _id: subProductId, availableStock: after, batchAllocations: batchAllocations || [] };
  }

  let deductedDoc = null;

  if (sizeId) {
    // ── Size-level deduction ──────────────────────────────────────────────────
    //
    // Stock may be tracked at the Size level, the SubProduct aggregate level, or both.
    // Products where stock is only tracked at the SubProduct level will show
    // Size.availableStock = 0 even when there is real stock — the combo/product
    // endpoints distribute SubProduct stock to sizes for DISPLAY only (in-memory),
    // they never write distributed stock back to the Size documents.
    //
    // Strategy:
    //   1. If the Size itself has enough stock → use the strict atomic filter.
    //   2. If the Size shows 0 but the SubProduct has enough aggregate stock →
    //      skip the Size stock guard (just update the Size doc) and rely on the
    //      SubProduct deduction below as the authoritative stock gate.
    //   3. If neither has stock and overselling is off → throw.

    let useStrictSizeFilter = false;

    if (!allowOverselling) {
      const [sizeCheck, spCheck] = await Promise.all([
        Size.findById(sizeId).select('availableStock').lean(),
        SubProduct.findById(subProductId).select('availableStock').lean(),
      ]);

      const sizeStock = sizeCheck?.availableStock ?? 0;
      const spStock   = spCheck?.availableStock   ?? 0;

      if (sizeStock >= quantity) {
        // Size has its own tracked stock — use strict atomic check
        useStrictSizeFilter = true;
      } else if (spStock < quantity) {
        // Neither Size nor SubProduct has enough — real stock-out
        throw new Error('Insufficient stock for this size');
      }
      // else: sizeStock < quantity but spStock >= quantity
      // → stock tracked at SubProduct level; proceed without size guard
    }

    const sizeFilter = (allowOverselling || !useStrictSizeFilter)
      ? { _id: sizeId }
      : { _id: sizeId, availableStock: { $gte: quantity } };

    deductedDoc = await Size.findOneAndUpdate(
      sizeFilter,
      { $inc: { availableStock: -quantity, stock: -quantity } },
      { new: true }
    );
    if (!deductedDoc) throw new Error('Insufficient stock for this size');

    // Update Size.availability
    await Size.findByIdAndUpdate(sizeId, {
      availability: resolveAvailability(deductedDoc.stock, deductedDoc.lowStockThreshold),
    });

    // Also decrement SubProduct aggregate stock.
    // When !useStrictSizeFilter the SubProduct is the real stock source, so guard
    // atomically here. When useStrictSizeFilter the Size was already guarded and
    // the SubProduct is a derived aggregate — update unconditionally.
    const spFilter = (!allowOverselling && !useStrictSizeFilter)
      ? { _id: subProductId, availableStock: { $gte: quantity } }
      : { _id: subProductId };

    const spUpdated = await SubProduct.findOneAndUpdate(
      spFilter,
      { $inc: { availableStock: -quantity, totalStock: -quantity, totalSold: quantity } },
      { new: true }
    );
    if (!spUpdated && !allowOverselling && !useStrictSizeFilter) {
      // Race condition: stock was taken between our pre-check and now; rollback size
      await Size.findByIdAndUpdate(sizeId, { $inc: { availableStock: quantity, stock: quantity } });
      throw new Error('Insufficient stock for this size');
    }
    if (spUpdated) {
      await SubProduct.findByIdAndUpdate(subProductId, {
        stockStatus: resolveSubProductStatus(spUpdated.availableStock, spUpdated.lowStockThreshold),
        status: spUpdated.availableStock <= 0 ? 'out_of_stock'
              : spUpdated.availableStock <= spUpdated.lowStockThreshold ? 'low_stock'
              : 'active',
      });
    }
  } else {
    // ── SubProduct-level deduction (no sizes) ─────────────────────────────────
    const spFilter = allowOverselling
      ? { _id: subProductId }
      : { _id: subProductId, availableStock: { $gte: quantity } };

    deductedDoc = await SubProduct.findOneAndUpdate(
      spFilter,
      { $inc: { availableStock: -quantity, totalStock: -quantity, totalSold: quantity } },
      { new: true }
    );
    if (!deductedDoc) throw new Error('Insufficient stock');

    await SubProduct.findByIdAndUpdate(subProductId, {
      stockStatus: resolveSubProductStatus(deductedDoc.availableStock, deductedDoc.lowStockThreshold),
      status: deductedDoc.availableStock <= 0 ? 'out_of_stock'
            : deductedDoc.availableStock <= deductedDoc.lowStockThreshold ? 'low_stock'
            : 'active',
    });
  }

  // ── Inventory movement audit record ────────────────────────────────────────
  const stockBefore = sizeId
    ? deductedDoc.availableStock + quantity   // pre-deduction value
    : deductedDoc.availableStock + quantity;

  const saleWarehouse = await inventoryService.resolveMovementWarehouse(tenantId, undefined);

  InventoryMovement.create({
    subProduct:     subProductId,
    tenant:         tenantId,
    warehouse:      saleWarehouse || undefined,
    product:        productId || undefined,
    size:           sizeId    || undefined,
    type:           'sold',
    category:       'out',
    quantity,
    quantityBefore: (sizeId ? deductedDoc.availableStock : deductedDoc.availableStock ?? 0) + quantity,
    quantityAfter:  deductedDoc.availableStock ?? 0,
    reference:      receiptNumber,
    referenceType:  'order',
    sellingPrice:   finalPrice,
    unitCost:       costPrice || 0,
    totalCost:      (costPrice || 0) * quantity,
    performedBy:    staffId || tenantId, // fallback to tenantId ObjectId if no staffId
    performedAt:    new Date(),
    source:         'order',
    status:         'confirmed',
    notes:          `POS sale — receipt ${receiptNumber}`,
  }).catch(err => console.error('[Inventory] POS deductStock audit failed:', err.message));

  return deductedDoc;
}

/**
 * Restore stock for one refund line.
 * Creates an InventoryMovement audit record.
 */
async function restoreStock({ subProductId, sizeId, quantity, tenantId, staffId, returnNumber, productId, unitPrice, warehouseId = null, defaultSizeId = null, batchAllocations = null }) {
  if (warehouseId) {
    // ── Warehouse-scoped restore ──────────────────────────────────────────
    const whSizeId = sizeId || defaultSizeId;
    const { before, after } = await returnStock(
      { warehouseId, subProduct: subProductId, size: whSizeId, quantity, batchAllocations },
      staffId, tenantId
    );

    await InventoryMovement.create({
      subProduct: subProductId, tenant: tenantId, warehouse: warehouseId, product: productId || undefined,
      size: whSizeId || undefined, type: 'return', category: 'in',
      quantity,
      quantityBefore: before,
      quantityAfter:  after,
      reference: returnNumber, referenceType: 'return',
      sellingPrice: unitPrice || 0,
      performedBy: staffId || tenantId,
      performedAt: new Date(),
      source: 'return', status: 'confirmed',
      notes: `POS return — ${returnNumber}`,
    }).catch(err => console.error('[Inventory] POS restoreStock audit failed:', err.message));
    return;
  }

  if (sizeId) {
    const sizeAfter = await Size.findByIdAndUpdate(
      sizeId,
      { $inc: { availableStock: quantity, stock: quantity } },
      { new: true }
    );
    if (sizeAfter) {
      await Size.findByIdAndUpdate(sizeId, {
        availability: resolveAvailability(sizeAfter.stock, sizeAfter.lowStockThreshold),
      });
    }

    // Also restore SubProduct aggregate stock
    const spAfter = await SubProduct.findByIdAndUpdate(
      subProductId,
      { $inc: { availableStock: quantity, totalStock: quantity, totalSold: -quantity } },
      { new: true }
    );
    if (spAfter) {
      await SubProduct.findByIdAndUpdate(subProductId, {
        stockStatus: resolveSubProductStatus(spAfter.availableStock, spAfter.lowStockThreshold),
        status: spAfter.availableStock <= 0 ? 'out_of_stock'
              : spAfter.availableStock <= spAfter.lowStockThreshold ? 'low_stock'
              : 'active',
      });
    }

    // Audit
    const restoreWarehouse = await inventoryService.resolveMovementWarehouse(tenantId, undefined);
    await InventoryMovement.create({
      subProduct: subProductId, tenant: tenantId, warehouse: restoreWarehouse || undefined, product: productId || undefined,
      size: sizeId, type: 'return', category: 'in',
      quantity,
      quantityBefore: (sizeAfter?.availableStock ?? 0) - quantity,
      quantityAfter:  sizeAfter?.availableStock ?? 0,
      reference: returnNumber, referenceType: 'return',
      sellingPrice: unitPrice || 0,
      performedBy: staffId || tenantId,
      performedAt: new Date(),
      source: 'return', status: 'confirmed',
      notes: `POS return — ${returnNumber}`,
    }).catch(err => console.error('[Inventory] POS restoreStock audit failed:', err.message));
  } else {
    const spAfter = await SubProduct.findByIdAndUpdate(
      subProductId,
      { $inc: { availableStock: quantity, totalStock: quantity, totalSold: -quantity } },
      { new: true }
    );
    if (spAfter) {
      await SubProduct.findByIdAndUpdate(subProductId, {
        stockStatus: resolveSubProductStatus(spAfter.availableStock, spAfter.lowStockThreshold),
        status: spAfter.availableStock <= 0 ? 'out_of_stock'
              : spAfter.availableStock <= spAfter.lowStockThreshold ? 'low_stock'
              : 'active',
      });
    }
    const restoreWarehouseNoSize = await inventoryService.resolveMovementWarehouse(tenantId, undefined);
    await InventoryMovement.create({
      subProduct: subProductId, tenant: tenantId, warehouse: restoreWarehouseNoSize || undefined,
      type: 'return', category: 'in',
      quantity,
      quantityBefore: (spAfter?.availableStock ?? 0) - quantity,
      quantityAfter:  spAfter?.availableStock ?? 0,
      reference: returnNumber, referenceType: 'return',
      performedBy: staffId || tenantId,
      performedAt: new Date(),
      source: 'return', status: 'confirmed',
      notes: `POS return — ${returnNumber}`,
    }).catch(err => console.error('[Inventory] POS restoreStock audit failed:', err.message));
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the full POS pricing details using the same pipeline as the website cart.
 * Returns both the selling price and the cost price needed for revenue tracking.
 *
 * @param {object} sp       - SubProduct document (lean, with product populated)
 * @param {object|null} sizeDoc - Size document (lean), or null for no-size products
 * @param {object} tenant   - Tenant document from req.tenant
 * @returns {{ sellingPrice, costPrice, revenueModel, markupPct, commissionPct }}
 */
function computePOSPricing(sp, sizeDoc, tenant) {
  const revenueModel      = tenant?.revenueModel        ?? 'markup';
  // POS quantity/bulk pricing comes from tenant pricelists (minQuantity rules),
  // not the platform pack trigger — always the normal rates here.
  const { markupPct, commissionPct } = resolveRevenueRates(tenant, 1);
  const platformMarkupPct = sp.product?.platformMarkup  ?? DEFAULT_PLATFORM_MARKUP;

  const productDiscount = sp.product?.platformDiscount?.value > 0 && sp.product?.platformDiscount?.type
    ? { value: sp.product.platformDiscount.value, type: sp.product.platformDiscount.type,
        start: sp.product.platformDiscount.start,  end: sp.product.platformDiscount.end }
    : null;

  // Size values fall back to subproduct when 0 (0 means "not set")
  const rawCost    = (sizeDoc?.costPrice    > 0 ? sizeDoc.costPrice    : null) ?? sp.costPrice        ?? 0;
  const rawSelling = (sizeDoc?.sellingPrice > 0 ? sizeDoc.sellingPrice : null) ?? sp.basePriceBeforePricelist ?? sp.baseSellingPrice ?? 0;

  if (rawCost <= 0 && rawSelling <= 0) {
    return { sellingPrice: 0, costPrice: 0, revenueModel, markupPct, commissionPct };
  }

  const platformCostPrice    = calcPlatformCostPrice(rawCost, rawSelling, revenueModel, markupPct, commissionPct);
  let   platformSellingPrice = calcPlatformSellingPrice(platformCostPrice, platformMarkupPct, productDiscount);
  const priceBeforeSale      = platformSellingPrice;

  const now = new Date();

  // ── Flash sale (checked first — takes priority over regular sale) ────────────
  const fs         = sp.flashSale;
  const flashStart = fs?.startDate ? new Date(fs.startDate) : null;
  const flashEnd   = fs?.endDate   ? new Date(fs.endDate)   : null;
  const flashActive =
    fs?.isActive === true &&
    (fs?.discountPercentage ?? 0) > 0 &&
    (!flashStart || now >= flashStart) &&
    (!flashEnd   || now <= flashEnd)   &&
    (fs?.remainingQuantity == null || fs.remainingQuantity > 0);

  if (flashActive) {
    platformSellingPrice = parseFloat((platformSellingPrice * (1 - fs.discountPercentage / 100)).toFixed(2));
  } else {
    // ── Regular sale discount ────────────────────────────────────────────────
    const saleStart  = sp.saleStartDate ? new Date(sp.saleStartDate) : null;
    const saleEnd    = sp.saleEndDate   ? new Date(sp.saleEndDate)   : null;
    const saleActive = sp.isOnSale &&
      (sp.saleDiscountValue ?? 0) > 0 &&
      (!saleStart || now >= saleStart) &&
      (!saleEnd   || now <= saleEnd);

    if (saleActive) {
      const dtype = sp.saleType || 'percentage';
      if (dtype === 'percentage' || dtype === 'flash_sale') {
        platformSellingPrice = parseFloat((platformSellingPrice * (1 - sp.saleDiscountValue / 100)).toFixed(2));
      } else if (dtype === 'fixed') {
        platformSellingPrice = Math.max(0, parseFloat((platformSellingPrice - sp.saleDiscountValue).toFixed(2)));
      }
    }
  }

  return {
    sellingPrice:       platformSellingPrice,
    originalPrice:      priceBeforeSale,
    isOnSale:           platformSellingPrice < priceBeforeSale,
    isFlashSale:        flashActive,
    costPrice:          platformCostPrice,
    revenueModel,
    markupPct,
    commissionPct,
  };
}
exports.computePOSPricing = computePOSPricing;

/** Convenience wrapper — returns just the selling price (used by getPOSProducts). */
function computePOSPrice(sp, sizeDoc, tenant) {
  return computePOSPricing(sp, sizeDoc, tenant).sellingPrice;
}

function startOfDay(d = new Date()) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfDay(d = new Date()) {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * Scope an Order query to a tenant.
 *
 * Orders carry the tenant in two places: a root `tenant` field, and a `tenant`
 * on every item. The root field is the simpler scope and is what the POS
 * handlers were always written against, but it went undeclared on the schema
 * for a long time, so orders created before it existed have only the per-item
 * one. Matching either keeps that history reachable — scoping on the root
 * alone silently hides every older order instead of erroring.
 */
function tenantScope(tenantId) {
  return { $or: [{ tenant: tenantId }, { 'items.tenant': tenantId }] };
}

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_money', 'split'];

/** Aggregate POS orders by payment method for a time range */
async function getPOSOrderStats(tenantId, from, to) {
  const agg = await Order.aggregate([
    {
      $match: {
        'items.tenant': tenantId,   // Order has no top-level tenant; filter via items
        source: 'pos',
        paymentStatus: 'paid',
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: '$paymentMethod',
        total: { $sum: '$totalAmount' },
        count: { $sum: 1 },
        tips:     { $sum: { $ifNull: ['$tipAmount', 0] } },
        rounding: { $sum: { $ifNull: ['$roundingAmount', 0] } },
      },
    },
  ]);
  let totalSales = 0;
  let orderCount = 0;
  // Tips and rounding are already inside totalAmount (it is the payable total).
  // They are reported separately so the Z-report can show what part of the
  // drawer is gratuity and what part is the rounding delta, rather than
  // leaving both buried in takings that no longer reconcile to the goods.
  let totalTips = 0;
  let totalRounding = 0;
  const breakdown = {};
  agg.forEach((g) => {
    totalSales += g.total;
    orderCount += g.count;
    totalTips += g.tips || 0;
    totalRounding += g.rounding || 0;
    breakdown[g._id] = {
      total: g.total,
      count: g.count,
      tips: g.tips || 0,
      rounding: g.rounding || 0,
    };
  });
  return { totalSales, orderCount, totalTips, totalRounding, breakdown };
}

/** Aggregate orders placed during an open session window */
async function getSessionOrderStats(tenantId, from, to) {
  return getPOSOrderStats(tenantId, from, to);
}

// ─── Open a session ──────────────────────────────────────────────────────────

/**
 * POST /api/pos/sessions/open
 * Body: { openingCash: number, notes: string }
 *
 * Odoo-style: captures opening cash balance, records the opening cashier,
 * initialises methodBalances with opening cash.
 */
exports.openSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant required' });

  const { openingCash = 0, notes = '', terminalType = 'retail' } = req.body;
  const validTerminals = ['retail', 'wholesale'];
  const terminal = validTerminals.includes(terminalType) ? terminalType : 'retail';

  const existing = await POSSession.findOne({ tenant: tenantId, status: 'open', terminalType: terminal });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `A ${terminal} session is already open`,
      data: { session: existing },
    });
  }
  const cashAmount = Math.max(0, Number(openingCash) || 0);

  const now = new Date();

  const session = await POSSession.create({
    tenant:     tenantId,
    openedBy:   req.user._id,
    activeCashier: req.user._id,
    terminalType: terminal,
    openingCash: cashAmount,
    openingBalance: cashAmount,   // legacy compat
    notes,
    status:    'open',
    openedAt:  now,
    // Seed methodBalances with opening cash
    methodBalances: [
      { method: 'cash',         opening: cashAmount, theoretical: cashAmount, counted: null, difference: null },
      { method: 'card',         opening: 0,          theoretical: 0,          counted: null, difference: null },
      { method: 'bank_transfer',opening: 0,          theoretical: 0,          counted: null, difference: null },
      { method: 'mobile_money', opening: 0,          theoretical: 0,          counted: null, difference: null },
    ],
    // Start cashier log
    cashierLog: [{ cashier: req.user._id, startedAt: now }],
  });

  await session.populate('openedBy activeCashier', 'firstName lastName email posName avatar');

  emitToTerminal(req, tenantId, terminal, 'session:opened', {
    sessionId:  session._id,
    terminal,
    openedBy:   req.user._id,
    openedAt:   now.toISOString(),
  });

  res.status(201).json({ success: true, data: { session } });
});

// ─── Closing Control — get theoretical values ────────────────────────────────

/**
 * GET /api/pos/sessions/:id/closing-control
 *
 * Odoo-style: returns current theoretical balances per payment method
 * before the cashier enters counted amounts. Call this to populate
 * the closing control screen.
 */
exports.getClosingControl = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, tenant: tenantId });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
  if (session.status === 'closed') {
    return res.status(400).json({ success: false, message: 'Session already closed' });
  }

  // Re-calculate theoretical values from all orders placed in this session window
  const stats = await getSessionOrderStats(tenantId, session.openedAt, new Date());

  // Net cash movements (in - out)
  const movements   = session.cashMovements || [];
  const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const netCashMove  = totalCashIn - totalCashOut;

  const methods = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const orderCount = stats.breakdown?.[method]?.count || 0;
    // For cash: theoretical = opening + cash sales + net cash movements
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal + netCashMove
      : orderTotal;

    return {
      method,
      opening:     method === 'cash' ? session.openingCash : 0,
      theoretical,
      orderTotal,
      orderCount,
    };
  });

  res.json({
    success: true,
    data: {
      sessionId:    session._id,
      openedAt:     session.openedAt,
      openingCash:  session.openingCash,
      totalSales:   stats.totalSales,
      orderCount:   stats.orderCount,
      totalTips:     stats.totalTips || 0,
      totalRounding: stats.totalRounding || 0,
      totalCashIn,
      totalCashOut,
      netCashMove,
      cashMovements: movements,
      methods,
    },
  });
});

// ─── Close a session ─────────────────────────────────────────────────────────

/**
 * POST /api/pos/sessions/:id/close
 * Body: {
 *   countedBalances: [{ method, counted }],   // cashier-entered closing amounts
 *   closingNotes: string
 * }
 *
 * Odoo-style: computes difference per method, flags discrepancies.
 */
exports.closeSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  // Atomically claim the session — only one close request wins.
  const session = await POSSession.findOneAndUpdate(
    { _id: req.params.id, tenant: tenantId, status: 'open' },
    { $set: { status: 'closed', closedBy: req.user._id, closedAt: new Date() } },
    { new: false }
  );

  if (!session) {
    // Either doesn't exist or already closed
    const exists = await POSSession.findOne({ _id: req.params.id, tenant: tenantId }).lean();
    if (!exists) return res.status(404).json({ success: false, message: 'Session not found' });
    return res.status(409).json({ success: false, message: 'Session already closed' });
  }

  const closedAt = new Date();

  // Final order stats
  const stats = await getSessionOrderStats(tenantId, session.openedAt, closedAt);

  // Net cash movements
  const movements    = session.cashMovements || [];
  const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const netCashMove  = totalCashIn - totalCashOut;

  // Build methodBalances with theoretical + counted + difference
  const { countedBalances = [], closingNotes = '' } = req.body;
  const methodBalances = PAYMENT_METHODS.filter(m => m !== 'split').map(method => {
    const orderTotal = stats.breakdown?.[method]?.total || 0;
    const theoretical = method === 'cash'
      ? session.openingCash + orderTotal + netCashMove
      : orderTotal;

    const countedEntry = countedBalances.find(b => b.method === method);
    const counted = countedEntry != null && countedEntry.counted != null
      ? Number(countedEntry.counted)
      : null;

    const difference = counted != null ? counted - theoretical : null;

    return { method, opening: method === 'cash' ? session.openingCash : 0, theoretical, counted, difference };
  });

  const hasDifference = methodBalances.some(
    m => m.difference != null && Math.abs(m.difference) > 0.01
  );

  // End active cashier log entry
  const log = session.cashierLog || [];
  const lastEntry = log[log.length - 1];
  if (lastEntry && !lastEntry.endedAt) {
    lastEntry.endedAt = closedAt;
  }

  // Update with computed values (session is already closed, just enriching)
  await POSSession.findByIdAndUpdate(session._id, {
    $set: {
      closingNotes,
      methodBalances,
      hasDifference,
      cashierLog: log,
      totalSales:       stats.totalSales,
      orderCount:       stats.orderCount,
      totalTips:        stats.totalTips     || 0,
      totalRounding:    stats.totalRounding || 0,
      cashSales:        stats.breakdown?.cash?.total        || 0,
      cardSales:        stats.breakdown?.card?.total        || 0,
      transferSales:    stats.breakdown?.bank_transfer?.total || 0,
      mobileMoneySales: stats.breakdown?.mobile_money?.total || 0,
      splitSales:       stats.breakdown?.split?.total       || 0,
      closingBalance:   (methodBalances.find(m => m.method === 'cash'))?.counted
        ?? (methodBalances.find(m => m.method === 'cash'))?.theoretical
        ?? 0,
    },
  });

  const updatedSession = await POSSession.findById(session._id)
    .populate('openedBy closedBy activeCashier', 'firstName lastName email posName');

  emitToTerminal(req, tenantId, session.terminalType, 'session:closed', {
    sessionId: session._id,
    terminal:  session.terminalType,
    closedBy:  req.user._id,
    closedAt:  closedAt.toISOString(),
  });

  res.json({ success: true, data: { session: updatedSession, hasDifference } });
});

// ─── Cash In / Cash Out ───────────────────────────────────────────────────────

/**
 * POST /api/pos/sessions/:id/cash-move
 * Body: { type: 'in'|'out', amount: number, reason?: string }
 *
 * Records a manual cash movement against the session.
 * Adjusts the theoretical cash balance used in closing control.
 */
exports.recordCashMove = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, tenant: tenantId, status: 'open' });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found or not open' });

  const { type, amount, reason = '' } = req.body;

  if (!['in', 'out'].includes(type)) {
    return res.status(400).json({ success: false, message: "type must be 'in' or 'out'" });
  }
  const num = Number(amount);
  if (!num || num <= 0) {
    return res.status(400).json({ success: false, message: 'amount must be a positive number' });
  }

  // Prevent cash-out exceeding current theoretical cash balance
  if (type === 'out') {
    const movements   = session.cashMovements || [];
    const totalCashIn  = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
    const totalCashOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
    const netMoves     = totalCashIn - totalCashOut;
    // Get cash sales from orders in this session
    const stats = await getSessionOrderStats(tenantId, session.openedAt, new Date());
    const cashAvailable = session.openingCash + (stats.breakdown?.cash?.total || 0) + netMoves;
    if (num > cashAvailable) {
      return res.status(400).json({
        success: false,
        message: `Insufficient cash. Available: ${cashAvailable.toFixed(2)}`,
      });
    }
  }

  const movement = {
    type,
    amount: parseFloat(num.toFixed(2)),
    reason: reason.trim(),
    performedBy: req.posUser._id,
    performedAt: new Date(),
  };

  session.cashMovements.push(movement);

  // Also update methodBalances theoretical for cash if session already has methodBalances
  if (session.methodBalances?.length) {
    const cashBalance = session.methodBalances.find(m => m.method === 'cash');
    if (cashBalance) {
      cashBalance.theoretical += type === 'in' ? num : -num;
    }
  }

  await session.save();
  await session.populate('cashMovements.performedBy', 'firstName lastName posName');

  const added = session.cashMovements[session.cashMovements.length - 1];

  res.status(201).json({
    success: true,
    data: {
      movement: added,
      cashMovements: session.cashMovements,
    },
  });
});

/**
 * GET /api/pos/sessions/:id/cash-moves
 */
exports.getCashMoves = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ _id: req.params.id, tenant: tenantId })
    .populate('cashMovements.performedBy', 'firstName lastName posName')
    .select('cashMovements status');
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  res.json({ success: true, data: { cashMovements: session.cashMovements || [] } });
});

// ─── Switch Cashier (mid-session) ────────────────────────────────────────────

/**
 * POST /api/pos/sessions/:id/switch-cashier
 * Body: { pin: string }
 *
 * Odoo-style: mid-session employee switching without closing the session.
 * Verifies PIN against all posAccess users for this tenant.
 * Updates session.activeCashier and appends to cashierLog.
 */
exports.switchCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { pin }  = req.body;

  if (!pin) return res.status(400).json({ success: false, message: 'PIN required' });

  const session = await POSSession.findOne({ _id: req.params.id, tenant: tenantId, status: 'open' });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found or not open' });

  // Find matching PIN among tenant's POS users
  const users = await User.find({
    tenant:     tenantId,
    posAccess:  true,
    posPinHash: { $exists: true, $ne: null },
    status:     'active',
  }).select('+posPinHash');

  let matchedUser = null;
  for (const u of users) {
    if (await bcrypt.compare(String(pin), u.posPinHash)) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  const now = new Date();

  // End the current cashier's log entry
  const log = session.cashierLog || [];
  const lastEntry = log[log.length - 1];
  if (lastEntry && !lastEntry.endedAt) {
    lastEntry.endedAt = now;
  }

  // Start new entry only if switching to a different cashier
  if (session.activeCashier?.toString() !== matchedUser._id.toString()) {
    log.push({ cashier: matchedUser._id, startedAt: now });
  } else {
    // Re-activating same cashier — just reopen the log entry
    log.push({ cashier: matchedUser._id, startedAt: now });
  }

  session.activeCashier = matchedUser._id;
  session.cashierLog    = log;
  await session.save();

  emitToTerminal(req, tenantId, session.terminalType, 'session:cashier_switched', {
    sessionId:   session._id,
    terminal:    session.terminalType,
    cashierId:   matchedUser._id,
    cashierName: matchedUser.posName || `${matchedUser.firstName} ${matchedUser.lastName}`.trim(),
    switchedAt:  now.toISOString(),
  });

  res.json({
    success: true,
    data: {
      cashier: {
        _id:      matchedUser._id,
        firstName: matchedUser.firstName,
        lastName:  matchedUser.lastName,
        posName:   matchedUser.posName,
        email:     matchedUser.email,
      },
    },
  });
});

// ─── Get current open session ────────────────────────────────────────────────

/**
 * GET /api/pos/sessions/current
 */
exports.getCurrentSession = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const session  = await POSSession.findOne({ tenant: tenantId, status: 'open' })
    .populate('openedBy activeCashier', 'firstName lastName email posName avatar')
    .sort({ openedAt: -1 });

  res.json({ success: true, data: { session: session || null } });
});

// ─── Session history ─────────────────────────────────────────────────────────

/**
 * GET /api/pos/sessions
 */
exports.getSessionList = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const limit    = Math.min(50, parseInt(req.query.limit) || 20);
  const skip     = (page - 1) * limit;
  const status   = req.query.status;
  const dateFrom = req.query.dateFrom;
  const dateTo   = req.query.dateTo;

  const filter = { tenant: tenantId };
  if (status === 'open' || status === 'closed') filter.status = status;
  if (dateFrom || dateTo) {
    filter.openedAt = {};
    if (dateFrom) filter.openedAt.$gte = new Date(dateFrom);
    if (dateTo)   filter.openedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  const [sessions, total] = await Promise.all([
    POSSession.find(filter)
      .populate('openedBy closedBy activeCashier', 'firstName lastName posName avatar')
      .populate({ path: 'cashierLog.cashier', select: 'firstName lastName posName', strictPopulate: false })
      .populate({ path: 'cashMovements.performedBy', select: 'firstName lastName posName', strictPopulate: false })
      .sort({ openedAt: -1 })
      .skip(skip)
      .limit(limit),
    POSSession.countDocuments(filter),
  ]);

  res.json({ success: true, data: { sessions, total, page, limit } });
});

// ─── POS Dashboard ───────────────────────────────────────────────────────────

/**
 * GET /api/pos/dashboard
 */
exports.getPOSDashboard = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const now = new Date();
  const todayStart     = startOfDay(now);
  const todayEnd       = endOfDay(now);
  const yesterdayStart = startOfDay(new Date(now - 86400000));
  const yesterdayEnd   = endOfDay(new Date(now - 86400000));
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayStats, yesterdayStats, monthStats, currentSession, recentOrders] = await Promise.all([
    getPOSOrderStats(tenantId, todayStart, todayEnd),
    getPOSOrderStats(tenantId, yesterdayStart, yesterdayEnd),
    getPOSOrderStats(tenantId, thisMonthStart, todayEnd),
    POSSession.findOne({ tenant: tenantId, status: 'open' })
      .populate('openedBy activeCashier', 'firstName lastName posName')
      .sort({ openedAt: -1 }),
    Order.find({ 'items.tenant': tenantId, source: 'pos', paymentStatus: 'paid' })
      .select('orderNumber totalAmount paymentMethod placedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  // 7-day chart — single aggregation instead of N+1 loop
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const chartAgg = await Order.aggregate([
    {
      $match: {
        ...tenantScope(tenantId),
        source: 'pos',
        paymentStatus: 'paid',
        isVoided: { $ne: true },
        placedAt: { $gte: sevenDaysAgo, $lte: endOfDay(now) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$placedAt' } },
        sales: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing days with zeros
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = startOfDay(d).toISOString().split('T')[0];
    const found = chartAgg.find((c) => c._id === dateStr);
    chartData.push({
      date: dateStr,
      sales: found?.sales || 0,
      orders: found?.orders || 0,
    });
  }

  res.json({
    success: true,
    data: {
      currentSession,
      today:     todayStats,
      yesterday: yesterdayStats,
      thisMonth: monthStats,
      chartData,
      recentOrders: recentOrders.map((o) => ({ ...o, total: o.totalAmount })),
    },
  });
});

// ─── PIN Login ───────────────────────────────────────────────────────────────

/**
 * POST /api/pos/auth/pin-login
 * Body: { tenantSlug, pin }
 */
exports.pinLogin = asyncHandler(async (req, res) => {
  const { tenantSlug, pin } = req.body;
  if (!tenantSlug || !pin) {
    return res.status(400).json({ success: false, message: 'tenantSlug and pin are required' });
  }

  // isActive is a Mongoose virtual (status === 'approved' && subscriptionStatus
  // in active/trialing), not a stored field — so it can't be used in the query
  // filter. Fetch by slug, then evaluate the virtual on the hydrated document.
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant || !tenant.isActive) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const users = await User.find({
    tenant:     tenant._id,
    posAccess:  true,
    posPinHash: { $exists: true, $ne: null },
    status:     'active',
  }).select('+posPinHash');

  if (!users.length) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  let matchedUser = null;
  for (const u of users) {
    if (await bcrypt.compare(String(pin), u.posPinHash)) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  const token = jwt.sign(
    { userId: matchedUser._id, email: matchedUser.email, role: matchedUser.role, tenant: matchedUser.tenant },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const refreshToken = jwt.sign(
    { userId: matchedUser._id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    data: {
      user: {
        _id:       matchedUser._id,
        email:     matchedUser.email,
        firstName: matchedUser.firstName,
        lastName:  matchedUser.lastName,
        posName:   matchedUser.posName,
        role:      matchedUser.role,
        tenant: { _id: tenant._id, slug: tenant.slug },
      },
      token,
      refreshToken,
    },
  });
});

// ─── List Cashiers ───────────────────────────────────────────────────────────

exports.listCashiers = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const cashiers = await User.find({
    tenant: tenantId,
    role:   { $in: ['tenant_staff', 'tenant_admin', 'tenant_owner'] },
    status: { $ne: 'deleted' },
  }).select('firstName lastName email phone posAccess posName role status createdAt avatar');

  res.json({ success: true, data: { cashiers } });
});

// ─── Create Cashier ──────────────────────────────────────────────────────────

exports.createCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { firstName, lastName, email, phone, pin, posName, posPermissions } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({ success: false, message: 'firstName and email are required' });
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

  const userData = {
    firstName,
    lastName:        lastName || '',
    email:           email.toLowerCase().trim(),
    phone,
    role:            'tenant_staff',
    tenant:          tenantId,
    posAccess:       true,
    posName:         posName || firstName,
    posPermissions:  posPermissions || ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'],
    status:          'active',
    isEmailVerified: true,
    passwordHash:    await bcrypt.hash(Math.random().toString(36) + Date.now(), 10),
  };

  if (pin) {
    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
    }
    userData.posPinHash = await bcrypt.hash(String(pin), 10);
  }

  const user = await User.create(userData);

  res.status(201).json({
    success: true,
    data: {
      cashier: {
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, phone: user.phone, posAccess: user.posAccess,
        posName: user.posName, role: user.role, status: user.status,
      },
    },
  });
});

// ─── Update Cashier ──────────────────────────────────────────────────────────

exports.updateCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });

  const { pin, posAccess, posName, firstName, lastName, phone, posPermissions } = req.body;

  if (pin !== undefined) {
    if (!/^\d{4,6}$/.test(String(pin))) {
      return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
    }
    user.posPinHash = await bcrypt.hash(String(pin), 10);
  }
  if (posAccess  !== undefined) user.posAccess  = Boolean(posAccess);
  if (posName    !== undefined) user.posName    = posName;
  if (firstName  !== undefined) user.firstName  = firstName;
  if (lastName   !== undefined) user.lastName   = lastName;
  if (phone      !== undefined) user.phone      = phone;

  await user.save();

  res.json({
    success: true,
    data: {
      cashier: {
        _id: user._id, firstName: user.firstName, lastName: user.lastName,
        email: user.email, phone: user.phone, posAccess: user.posAccess,
        posName: user.posName, role: user.role, status: user.status,
      },
    },
  });
});

// ─── Delete Cashier ──────────────────────────────────────────────────────────

exports.deleteCashier = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user) return res.status(404).json({ success: false, message: 'Cashier not found' });
  if (user.role === 'tenant_owner') {
    return res.status(403).json({ success: false, message: 'Cannot delete tenant owner' });
  }
  user.status = 'deleted';
  await user.save();
  res.json({ success: true, message: 'Cashier removed' });
});

// ─── Tenant Bank Accounts ────────────────────────────────────────────────────

/**
 * PATCH /api/pos/tenant/bank-accounts
 * Body: { bankAccounts: [{ bankName, accountNumber, accountName }] }
 * Replaces the tenant's full bank account list.
 */
exports.updateTenantBankAccounts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { bankAccounts } = req.body;
  if (!Array.isArray(bankAccounts)) {
    return res.status(400).json({ success: false, message: 'bankAccounts must be an array' });
  }

  const cleaned = bankAccounts
    .filter((b) => b.bankName || b.accountNumber)
    .map((b) => ({
      bankName:      (b.bankName      || '').trim(),
      accountNumber: (b.accountNumber || '').trim(),
      accountName:   (b.accountName   || '').trim(),
    }));

  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { bankAccounts: cleaned },
    { new: true, select: 'bankAccounts name' }
  );

  res.json({ success: true, data: { bankAccounts: tenant.bankAccounts } });
});

/**
 * GET /api/pos/tenant/bank-accounts
 */
exports.getTenantBankAccounts = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenant?._id).select('bankAccounts');
  res.json({ success: true, data: { bankAccounts: tenant?.bankAccounts || [] } });
});

/**
 * GET /api/pos/tenant/settings
 */
exports.getPOSSettings = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenant?._id)
    .select('posSettings')
    .populate('posSettings.shops.warehouse', 'name code');
  res.json({ success: true, data: { posSettings: tenant?.posSettings || {} } });
});

/**
 * PATCH /api/pos/tenant/settings
 * Body: { posSettings: { allowOverselling?: boolean } }
 */
exports.updatePOSSettings = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { posSettings = {} } = req.body;

  const allowed = {};
  if (typeof posSettings.allowOverselling === 'boolean')
    allowed['posSettings.allowOverselling'] = posSettings.allowOverselling;

  // Restaurant mode
  if (typeof posSettings.isBarRestaurant === 'boolean')
    allowed['posSettings.isBarRestaurant'] = posSettings.isBarRestaurant;

  // Payment options
  if (typeof posSettings.autoValidateOrder === 'boolean')
    allowed['posSettings.autoValidateOrder'] = posSettings.autoValidateOrder;
  if (typeof posSettings.cashRounding === 'boolean')
    allowed['posSettings.cashRounding'] = posSettings.cashRounding;
  // Constrained to the schema's enum here as well as in the model, so a bad
  // value is rejected at the edge rather than surfacing as a cast error.
  if ([1, 5, 10, 50].includes(Number(posSettings.roundingIncrement)))
    allowed['posSettings.roundingIncrement'] = Number(posSettings.roundingIncrement);
  if (typeof posSettings.maxDifferenceEnabled === 'boolean')
    allowed['posSettings.maxDifferenceEnabled'] = posSettings.maxDifferenceEnabled;
  if (typeof posSettings.tipsEnabled === 'boolean')
    allowed['posSettings.tipsEnabled'] = posSettings.tipsEnabled;
  // Kitchen display: minutes before an unfired/bumped round highlights late.
  if (typeof posSettings.kitchenAlertMins === 'number' && Number(posSettings.kitchenAlertMins) >= 1)
    allowed['posSettings.kitchenAlertMins'] = Math.floor(posSettings.kitchenAlertMins);

  // POS interface
  if (typeof posSettings.loginWithEmployees === 'boolean')
    allowed['posSettings.loginWithEmployees'] = posSettings.loginWithEmployees;
  if (typeof posSettings.largeScrollbars === 'boolean')
    allowed['posSettings.largeScrollbars'] = posSettings.largeScrollbars;
  if (typeof posSettings.shareOpenOrders === 'boolean')
    allowed['posSettings.shareOpenOrders'] = posSettings.shareOpenOrders;
  if (typeof posSettings.hidePictures === 'boolean')
    allowed['posSettings.hidePictures'] = posSettings.hidePictures;
  if (typeof posSettings.showProductImages === 'boolean')
    allowed['posSettings.showProductImages'] = posSettings.showProductImages;
  if (typeof posSettings.showCategoryImages === 'boolean')
    allowed['posSettings.showCategoryImages'] = posSettings.showCategoryImages;

  // Product & POS categories
  if (typeof posSettings.restrictCategories === 'boolean')
    allowed['posSettings.restrictCategories'] = posSettings.restrictCategories;
  if (typeof posSettings.showMarginsAndCosts === 'boolean')
    allowed['posSettings.showMarginsAndCosts'] = posSettings.showMarginsAndCosts;
  if (typeof posSettings.sortCartByCategory === 'boolean')
    allowed['posSettings.sortCartByCategory'] = posSettings.sortCartByCategory;

  // Pricing
  if (typeof posSettings.flexiblePricelists === 'boolean')
    allowed['posSettings.flexiblePricelists'] = posSettings.flexiblePricelists;
  if (typeof posSettings.priceControl === 'boolean')
    allowed['posSettings.priceControl'] = posSettings.priceControl;
  if (['tax_excluded', 'tax_included'].includes(posSettings.productPriceDisplay))
    allowed['posSettings.productPriceDisplay'] = posSettings.productPriceDisplay;
  if (typeof posSettings.lineDiscounts === 'boolean')
    allowed['posSettings.lineDiscounts'] = posSettings.lineDiscounts;
  if (typeof posSettings.globalDiscounts === 'boolean')
    allowed['posSettings.globalDiscounts'] = posSettings.globalDiscounts;
  if (typeof posSettings.promotionsEnabled === 'boolean')
    allowed['posSettings.promotionsEnabled'] = posSettings.promotionsEnabled;

  // Sales controls
  if (typeof posSettings.maxDiscountPct === 'number')
    allowed['posSettings.maxDiscountPct'] = Math.min(100, Math.max(0, posSettings.maxDiscountPct));

  // Session controls
  if (typeof posSettings.requireOpeningCash === 'boolean')
    allowed['posSettings.requireOpeningCash'] = posSettings.requireOpeningCash;

  // Payment methods
  if (Array.isArray(posSettings.enabledPaymentMethods)) {
    const valid = ['cash', 'card', 'bank_transfer', 'mobile_money'];
    allowed['posSettings.enabledPaymentMethods'] = posSettings.enabledPaymentMethods.filter(m => valid.includes(m));
  }

  // Receipt
  if (typeof posSettings.receiptHeader === 'string')
    allowed['posSettings.receiptHeader'] = posSettings.receiptHeader.trim().slice(0, 200);
  if (typeof posSettings.receiptFooter === 'string')
    allowed['posSettings.receiptFooter'] = posSettings.receiptFooter.trim().slice(0, 200);
  if (typeof posSettings.showTaxOnReceipt === 'boolean')
    allowed['posSettings.showTaxOnReceipt'] = posSettings.showTaxOnReceipt;
  if (typeof posSettings.taxRate === 'number')
    allowed['posSettings.taxRate'] = Math.min(100, Math.max(0, posSettings.taxRate));
  if (typeof posSettings.autoPrintReceipt === 'boolean')
    allowed['posSettings.autoPrintReceipt'] = posSettings.autoPrintReceipt;
  if (typeof posSettings.receiptCopies === 'number')
    allowed['posSettings.receiptCopies'] = Math.min(5, Math.max(1, Math.round(posSettings.receiptCopies)));
  if (typeof posSettings.smsReceiptEnabled === 'boolean')
    allowed['posSettings.smsReceiptEnabled'] = posSettings.smsReceiptEnabled;
  if (typeof posSettings.selfServiceInvoicing === 'boolean')
    allowed['posSettings.selfServiceInvoicing'] = posSettings.selfServiceInvoicing;
  if (typeof posSettings.basicReceipt === 'boolean')
    allowed['posSettings.basicReceipt'] = posSettings.basicReceipt;
  if (typeof posSettings.whatsappReceiptEnabled === 'boolean')
    allowed['posSettings.whatsappReceiptEnabled'] = posSettings.whatsappReceiptEnabled;

  // Payment terminals
  if (Array.isArray(posSettings.enabledPaymentTerminals)) {
    const validTerminals = ['adyen','stripe','six','viva_wallet','paytm','razorpay','mercado_pago'];
    allowed['posSettings.enabledPaymentTerminals'] = posSettings.enabledPaymentTerminals.filter(t => validTerminals.includes(t));
  }

  // Connected devices
  if (typeof posSettings.eposPrinter === 'boolean')
    allowed['posSettings.eposPrinter'] = posSettings.eposPrinter;
  if (typeof posSettings.customerDisplay === 'boolean')
    allowed['posSettings.customerDisplay'] = posSettings.customerDisplay;
  if (typeof posSettings.iotBox === 'boolean')
    allowed['posSettings.iotBox'] = posSettings.iotBox;

  // Preparation
  if (typeof posSettings.preparationPrinters === 'boolean')
    allowed['posSettings.preparationPrinters'] = posSettings.preparationPrinters;
  if (typeof posSettings.preparationDisplay === 'boolean')
    allowed['posSettings.preparationDisplay'] = posSettings.preparationDisplay;
  if (typeof posSettings.internalNotes === 'boolean')
    allowed['posSettings.internalNotes'] = posSettings.internalNotes;

  // Inventory
  if (typeof posSettings.allowShipLater === 'boolean')
    allowed['posSettings.allowShipLater'] = posSettings.allowShipLater;
  if (typeof posSettings.barcodes === 'boolean')
    allowed['posSettings.barcodes'] = posSettings.barcodes;

  // Customers
  if (typeof posSettings.requireCustomer === 'boolean')
    allowed['posSettings.requireCustomer'] = posSettings.requireCustomer;
  if (typeof posSettings.showLoyaltyBalanceAtCheckout === 'boolean')
    allowed['posSettings.showLoyaltyBalanceAtCheckout'] = posSettings.showLoyaltyBalanceAtCheckout;
  if (typeof posSettings.customerPhoneSearch === 'boolean')
    allowed['posSettings.customerPhoneSearch'] = posSettings.customerPhoneSearch;

  // Order management
  if (typeof posSettings.allowOrderNotes === 'boolean')
    allowed['posSettings.allowOrderNotes'] = posSettings.allowOrderNotes;
  if (typeof posSettings.holdOrders === 'boolean')
    allowed['posSettings.holdOrders'] = posSettings.holdOrders;
  if (typeof posSettings.splitPayments === 'boolean')
    allowed['posSettings.splitPayments'] = posSettings.splitPayments;
  if (typeof posSettings.minimumOrderAmount === 'number' && posSettings.minimumOrderAmount >= 0)
    allowed['posSettings.minimumOrderAmount'] = posSettings.minimumOrderAmount;

  // Refunds & returns
  if (typeof posSettings.allowRefunds === 'boolean')
    allowed['posSettings.allowRefunds'] = posSettings.allowRefunds;
  if (typeof posSettings.refundWindowDays === 'number' && posSettings.refundWindowDays >= 0)
    allowed['posSettings.refundWindowDays'] = posSettings.refundWindowDays;
  if (typeof posSettings.requireManagerApprovalForRefund === 'boolean')
    allowed['posSettings.requireManagerApprovalForRefund'] = posSettings.requireManagerApprovalForRefund;
  if (typeof posSettings.defaultRestockOnRefund === 'boolean')
    allowed['posSettings.defaultRestockOnRefund'] = posSettings.defaultRestockOnRefund;

  // Security
  if (typeof posSettings.sessionTimeoutMins === 'number' && posSettings.sessionTimeoutMins >= 0)
    allowed['posSettings.sessionTimeoutMins'] = posSettings.sessionTimeoutMins;
  if (typeof posSettings.requirePINOnUnlock === 'boolean')
    allowed['posSettings.requirePINOnUnlock'] = posSettings.requirePINOnUnlock;
  if (typeof posSettings.requireManagerPINForDiscount === 'boolean')
    allowed['posSettings.requireManagerPINForDiscount'] = posSettings.requireManagerPINForDiscount;

  // Currency & number format
  if (typeof posSettings.currencySymbol === 'string')
    allowed['posSettings.currencySymbol'] = posSettings.currencySymbol.slice(0, 4);
  if (['before', 'after'].includes(posSettings.currencyPosition))
    allowed['posSettings.currencyPosition'] = posSettings.currencyPosition;
  if ([0, 1, 2].includes(posSettings.decimalPlaces))
    allowed['posSettings.decimalPlaces'] = posSettings.decimalPlaces;

  // Receipt extras
  if (typeof posSettings.showCashierName === 'boolean')
    allowed['posSettings.showCashierName'] = posSettings.showCashierName;
  if (typeof posSettings.showOrderNumber === 'boolean')
    allowed['posSettings.showOrderNumber'] = posSettings.showOrderNumber;
  if (typeof posSettings.receiptNumberPrefix === 'string')
    allowed['posSettings.receiptNumberPrefix'] = posSettings.receiptNumberPrefix.slice(0, 10);

  // Loyalty
  if (typeof posSettings.loyaltyEnabled === 'boolean')
    allowed['posSettings.loyaltyEnabled'] = posSettings.loyaltyEnabled;
  if (typeof posSettings.loyaltyPointsPerNaira === 'number' && posSettings.loyaltyPointsPerNaira > 0)
    allowed['posSettings.loyaltyPointsPerNaira'] = posSettings.loyaltyPointsPerNaira;
  if (typeof posSettings.loyaltyPointsValue === 'number' && posSettings.loyaltyPointsValue > 0)
    allowed['posSettings.loyaltyPointsValue'] = posSettings.loyaltyPointsValue;
  if (typeof posSettings.loyaltyMaxRedemptionPct === 'number')
    allowed['posSettings.loyaltyMaxRedemptionPct'] = Math.min(100, Math.max(0, posSettings.loyaltyMaxRedemptionPct));

  // Discount programs
  if (Array.isArray(posSettings.discountPrograms)) {
    allowed['posSettings.discountPrograms'] = posSettings.discountPrograms.map(p => ({
      name:          String(p.name        || '').trim().slice(0, 60),
      description:   String(p.description || '').trim().slice(0, 200),
      type:          ['pct','fixed'].includes(p.type) ? p.type : 'pct',
      value:         Math.max(0, Number(p.value) || 0),
      active:        p.active !== false,
      color:         String(p.color || '').slice(0, 20),
      minOrderValue: Math.max(0, Number(p.minOrderValue) || 0),
    })).filter(p => p.name && p.value > 0);
  }

  function normaliseAvailability(a) {
    if (!a) return { pos: true, sales: false, website: false };
    return { pos: a.pos !== false, sales: !!a.sales, website: !!a.website };
  }
  function normaliseRules(r) {
    if (!r) return { minQty: 0, minOrderValue: 0 };
    return { minQty: Math.max(0, Number(r.minQty)||0), minOrderValue: Math.max(0, Number(r.minOrderValue)||0) };
  }
  function normaliseReward(rw) {
    if (!rw) return { discountType: 'pct', discountValue: 0, applyOn: 'order', maxDiscount: 0 };
    return {
      discountType:  ['pct','fixed'].includes(rw.discountType) ? rw.discountType : 'pct',
      discountValue: Math.max(0, Number(rw.discountValue)||0),
      applyOn:       ['order','cheapest','most_expensive'].includes(rw.applyOn) ? rw.applyOn : 'order',
      maxDiscount:   Math.max(0, Number(rw.maxDiscount)||0),
    };
  }

  // Coupons
  if (Array.isArray(posSettings.coupons)) {
    allowed['posSettings.coupons'] = posSettings.coupons.map(c => ({
      code:          String(c.code || '').trim().toUpperCase().slice(0, 30),
      name:          String(c.name || '').trim().slice(0, 60),
      description:   String(c.description || '').slice(0, 200),
      pricelistIds:       Array.isArray(c.pricelistIds)       ? c.pricelistIds.filter(Boolean)       : [],
      applyTo: { products: Array.isArray(c.applyTo?.products) ? c.applyTo.products.filter(Boolean) : [], categories: Array.isArray(c.applyTo?.categories) ? c.applyTo.categories.filter(Boolean) : [], brands: Array.isArray(c.applyTo?.brands) ? c.applyTo.brands.filter(Boolean) : [] },
      availableOn:   normaliseAvailability(c.availableOn),
      rules:         normaliseRules(c.rules),
      reward:        normaliseReward(c.reward),
      type:          ['pct','fixed'].includes(c.type) ? c.type : 'pct',
      value:         Math.max(0, Number(c.value) || 0),
      minOrderValue: Math.max(0, Number(c.minOrderValue) || 0),
      maxUsage:      Math.max(0, Number(c.maxUsage) || 0),
      usageCount:    Math.max(0, Number(c.usageCount) || 0),
      validFrom:     c.validFrom ? new Date(c.validFrom) : null,
      validTo:       c.validTo   ? new Date(c.validTo)   : null,
      active:        c.active !== false,
      onePerOrder:   !!c.onePerOrder,
    })).filter(c => c.code && c.value > 0);
  }

  // Discount codes
  if (Array.isArray(posSettings.discountCodes)) {
    allowed['posSettings.discountCodes'] = posSettings.discountCodes.map(d => ({
      code:          String(d.code || '').trim().toUpperCase().slice(0, 30),
      name:          String(d.name || '').trim().slice(0, 60),
      description:   String(d.description || '').slice(0, 200),
      pricelistIds:       Array.isArray(d.pricelistIds)       ? d.pricelistIds.filter(Boolean)       : [],
      applyTo: { products: Array.isArray(d.applyTo?.products) ? d.applyTo.products.filter(Boolean) : [], categories: Array.isArray(d.applyTo?.categories) ? d.applyTo.categories.filter(Boolean) : [], brands: Array.isArray(d.applyTo?.brands) ? d.applyTo.brands.filter(Boolean) : [] },
      availableOn:   normaliseAvailability(d.availableOn),
      rules:         normaliseRules(d.rules),
      reward:        normaliseReward(d.reward),
      type:          ['pct','fixed'].includes(d.type) ? d.type : 'pct',
      value:         Math.max(0, Number(d.value) || 0),
      minOrderValue: Math.max(0, Number(d.minOrderValue) || 0),
      validFrom:     d.validFrom  ? new Date(d.validFrom)  : null,
      validTo:       d.validTo    ? new Date(d.validTo)    : null,
      maxUsage:      Math.max(0, Number(d.maxUsage) || 0),
      usageCount:    Math.max(0, Number(d.usageCount) || 0),
      color:         typeof d.color === 'string' ? d.color.slice(0, 20) : '#059669',
      active:        d.active !== false,
    })).filter(d => d.code && d.value > 0);
  }

  // Promotions
  if (Array.isArray(posSettings.promotions)) {
    allowed['posSettings.promotions'] = posSettings.promotions.map(pr => ({
      name:          String(pr.name || '').trim().slice(0, 60),
      description:   String(pr.description || '').slice(0, 200),
      pricelistIds:       Array.isArray(pr.pricelistIds)       ? pr.pricelistIds.filter(Boolean)       : [],
      applyTo: { products: Array.isArray(pr.applyTo?.products) ? pr.applyTo.products.filter(Boolean) : [], categories: Array.isArray(pr.applyTo?.categories) ? pr.applyTo.categories.filter(Boolean) : [], brands: Array.isArray(pr.applyTo?.brands) ? pr.applyTo.brands.filter(Boolean) : [] },
      availableOn:   normaliseAvailability(pr.availableOn),
      rules:         normaliseRules(pr.rules),
      reward:        normaliseReward(pr.reward),
      type:          ['pct','fixed'].includes(pr.type) ? pr.type : 'pct',
      value:         Math.max(0, Number(pr.value) || 0),
      startDate:     pr.startDate ? new Date(pr.startDate) : null,
      endDate:       pr.endDate   ? new Date(pr.endDate)   : null,
      maxUsage:   Math.max(0, Number(pr.maxUsage) || 0),
      usageCount: Math.max(0, Number(pr.usageCount) || 0),
      color:      typeof pr.color === 'string' ? pr.color.slice(0, 20) : '#d97706',
      stackable:  !!pr.stackable,
      priority:   Math.max(0, Number(pr.priority) || 0),
      active:     pr.active !== false,
    })).filter(pr => pr.name && pr.value > 0);
  }

  // Buy X Get Y
  if (Array.isArray(posSettings.buyXGetY)) {
    allowed['posSettings.buyXGetY'] = posSettings.buyXGetY.map(b => ({
      name:           String(b.name || '').trim().slice(0, 60),
      description:    String(b.description || '').slice(0, 200),
      pricelistIds:  Array.isArray(b.pricelistIds)  ? b.pricelistIds.filter(Boolean)  : [],
      buyProducts:   Array.isArray(b.buyProducts)   ? b.buyProducts.filter(Boolean)   : [],
      getProducts:   Array.isArray(b.getProducts)   ? b.getProducts.filter(Boolean)   : [],
      availableOn:    normaliseAvailability(b.availableOn),
      buyQty:         Math.max(1, Number(b.buyQty) || 1),
      getQty:         Math.max(1, Number(b.getQty) || 1),
      getDiscountPct: Math.min(100, Math.max(0, Number(b.getDiscountPct) || 100)),
      minOrderValue:  Math.max(0, Number(b.minOrderValue) || 0),
      maxUsage:   Math.max(0, Number(b.maxUsage) || 0),
      usageCount: Math.max(0, Number(b.usageCount) || 0),
      validFrom:  b.validFrom ? new Date(b.validFrom) : null,
      validTo:    b.validTo   ? new Date(b.validTo)   : null,
      color:      typeof b.color === 'string' ? b.color.slice(0, 20) : '#7c3aed',
      stackable:  !!b.stackable,
      active:     b.active !== false,
    })).filter(b => b.name);
  }

  // Loyalty card config
  if (posSettings.loyaltyCard && typeof posSettings.loyaltyCard === 'object') {
    const lc = posSettings.loyaltyCard;
    if (typeof lc.enabled        === 'boolean') allowed['posSettings.loyaltyCard.enabled']        = lc.enabled;
    if (typeof lc.cardPrefix     === 'string')  allowed['posSettings.loyaltyCard.cardPrefix']      = lc.cardPrefix.slice(0, 10);
    if (typeof lc.earnMultiplier === 'number')  allowed['posSettings.loyaltyCard.earnMultiplier']  = Math.max(0.1, lc.earnMultiplier);
    if (typeof lc.welcomeBonus   === 'number')  allowed['posSettings.loyaltyCard.welcomeBonus']    = Math.max(0, lc.welcomeBonus);
    if (typeof lc.pointsExpiry   === 'number')  allowed['posSettings.loyaltyCard.pointsExpiry']    = Math.max(0, Math.floor(lc.pointsExpiry));
    if (typeof lc.minRedemption       === 'number')  allowed['posSettings.loyaltyCard.minRedemption']       = Math.max(0, Math.floor(lc.minRedemption));
    if (typeof lc.bonusMultiplierDays === 'number')  allowed['posSettings.loyaltyCard.bonusMultiplierDays']  = Math.max(1, lc.bonusMultiplierDays);
    if (Array.isArray(lc.doublePointsDays)) {
      allowed['posSettings.loyaltyCard.doublePointsDays'] = lc.doublePointsDays.filter(d => d >= 0 && d <= 6).map(Number);
    }
    if (Array.isArray(lc.tiers)) {
      allowed['posSettings.loyaltyCard.tiers'] = lc.tiers
        .filter(t => t.name?.trim())
        .map(t => ({
          name:       String(t.name).trim().slice(0, 30),
          minPoints:  Math.max(0, Number(t.minPoints) || 0),
          multiplier: Math.max(0.1, Number(t.multiplier) || 1),
          color:      t.color || '#d97706',
          benefits:   String(t.benefits || '').slice(0, 200),
        }));
    }
  }

  // Next order coupon config
  if (posSettings.nextOrderCoupon && typeof posSettings.nextOrderCoupon === 'object') {
    const noc = posSettings.nextOrderCoupon;
    if (typeof noc.enabled           === 'boolean') allowed['posSettings.nextOrderCoupon.enabled']           = noc.enabled;
    if (['pct','fixed'].includes(noc.type))         allowed['posSettings.nextOrderCoupon.type']              = noc.type;
    if (typeof noc.value             === 'number')  allowed['posSettings.nextOrderCoupon.value']             = Math.max(0, noc.value);
    if (typeof noc.validDays         === 'number')  allowed['posSettings.nextOrderCoupon.validDays']         = Math.max(1, noc.validDays);
    if (typeof noc.minOrderForCoupon === 'number')  allowed['posSettings.nextOrderCoupon.minOrderForCoupon'] = Math.max(0, noc.minOrderForCoupon);
    if (typeof noc.minRedeemOrder    === 'number')  allowed['posSettings.nextOrderCoupon.minRedeemOrder']    = Math.max(0, noc.minRedeemOrder);
    if (typeof noc.codePrefix        === 'string')  allowed['posSettings.nextOrderCoupon.codePrefix']        = noc.codePrefix.slice(0, 10);
    if (typeof noc.color             === 'string')  allowed['posSettings.nextOrderCoupon.color']             = noc.color.slice(0, 20);
    if (typeof noc.oneUse            === 'boolean') allowed['posSettings.nextOrderCoupon.oneUse']            = noc.oneUse;
    if (noc.availableOn && typeof noc.availableOn === 'object') {
      allowed['posSettings.nextOrderCoupon.availableOn'] = normaliseAvailability(noc.availableOn);
    }
  }

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ success: false, message: 'No valid settings provided' });
  }

  const tenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { $set: allowed },
    { new: true, select: 'posSettings' }
  );

  res.json({ success: true, data: { posSettings: tenant?.posSettings || {} } });
});

// ─── POS Shops CRUD ──────────────────────────────────────────────────────────

exports.listPOSShops = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const tenant = await Tenant.findById(tenantId)
    .select('posSettings.shops')
    .populate('posSettings.shops.warehouse', 'name code');
  const shops = (tenant?.posSettings?.shops || []).filter(s => s.active !== false);
  res.json({ success: true, data: { shops } });
});

exports.createPOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { name, mode = 'retail', color = '#b20202', description = '', warehouse } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Shop name is required' });
  }
  if (!['retail', 'wholesale'].includes(mode)) {
    return res.status(400).json({ success: false, message: 'mode must be retail or wholesale' });
  }

  let warehouseId = null;
  if (warehouse) {
    const wh = await Warehouse.findOne({ _id: warehouse, tenant: tenantId, isActive: true });
    if (!wh) return res.status(400).json({ success: false, message: 'Warehouse not found or inactive' });
    warehouseId = wh._id;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  tenant.posSettings.shops = tenant.posSettings.shops || [];
  tenant.posSettings.shops.push({ name: name.trim(), mode, color, description, warehouse: warehouseId, active: true, createdAt: new Date() });
  await tenant.save();
  await tenant.populate('posSettings.shops.warehouse', 'name code');

  const created = tenant.posSettings.shops[tenant.posSettings.shops.length - 1];
  res.status(201).json({ success: true, data: { shop: created } });
});

exports.updatePOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { shopId } = req.params;
  const { name, mode, color, description, active, warehouse } = req.body;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const shop = (tenant.posSettings.shops || []).id(shopId);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

  if (name !== undefined) shop.name = name.trim();
  if (mode !== undefined && ['retail', 'wholesale'].includes(mode)) shop.mode = mode;
  if (color !== undefined) shop.color = color;
  if (description !== undefined) shop.description = description;
  if (active !== undefined) shop.active = !!active;

  if (warehouse !== undefined) {
    if (!warehouse) {
      shop.warehouse = null;
    } else {
      const wh = await Warehouse.findOne({ _id: warehouse, tenant: tenantId, isActive: true });
      if (!wh) return res.status(400).json({ success: false, message: 'Warehouse not found or inactive' });
      shop.warehouse = wh._id;
    }
  }

  await tenant.save();
  await tenant.populate('posSettings.shops.warehouse', 'name code');
  const updatedShop = tenant.posSettings.shops.id(shopId);
  res.json({ success: true, data: { shop: updatedShop } });
});

exports.deletePOSShop = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenant;
  const { shopId } = req.params;

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  const shop = (tenant.posSettings.shops || []).id(shopId);
  if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

  shop.deleteOne();
  await tenant.save();
  res.json({ success: true, data: { message: 'Shop deleted' } });
});

// ─── POS Staff Login ─────────────────────────────────────────────────────────
/**
 * POST /api/pos/auth/staff-login
 * Body: { tenantSlug, staffId, pin?, password? }
 * Returns POS-specific JWT (12h) with type:'pos'
 */
exports.staffLogin = asyncHandler(async (req, res) => {
  const { tenantSlug, staffId, pin, password } = req.body;
  if (!tenantSlug || !staffId) {
    return res.status(400).json({ success: false, message: 'tenantSlug and staffId required' });
  }

  // isActive is a Mongoose virtual (status === 'approved' && subscriptionStatus
  // in active/trialing), not a stored field — so it can't be used in the query
  // filter. Fetch by slug, then evaluate the virtual on the hydrated document.
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant || !tenant.isActive) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const user = await User.findOne({
    _id: staffId,
    tenant: tenant._id,
    posAccess: true,
    status: 'active',
  }).select('+posPinHash +passwordHash');

  if (!user) return res.status(401).json({ success: false, message: 'Staff not found or no POS access' });

  // Verify PIN or password
  let authenticated = false;
  if (pin && user.posPinHash) {
    authenticated = await bcrypt.compare(String(pin), user.posPinHash);
  } else if (password && user.passwordHash) {
    authenticated = await bcrypt.compare(password, user.passwordHash);
  }

  if (!authenticated) {
    return res.status(401).json({ success: false, message: 'Invalid PIN or password' });
  }

  const posToken = jwt.sign(
    {
      type:           'pos',
      userId:         user._id,
      tenantId:       tenant._id,
      tenantSlug:     tenant.slug,
      role:           user.role,
      posPermissions: user.posPermissions || ['pos:sell'],
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    success: true,
    data: {
      token: posToken,
      staff: {
        _id:            user._id,
        firstName:      user.firstName,
        lastName:       user.lastName,
        posName:        user.posName,
        role:           user.role,
        posPermissions: user.posPermissions,
        avatar:         user.avatar,
      },
      tenant: {
        _id:          tenant._id,
        slug:         tenant.slug,
        name:         tenant.name,
        primaryColor: tenant.primaryColor,
        logo:         tenant.logo?.url || null,
        posSettings:  {
          allowOverselling:      tenant.posSettings?.allowOverselling ?? false,
          isBarRestaurant:       tenant.posSettings?.isBarRestaurant ?? false,
          autoValidateOrder:     tenant.posSettings?.autoValidateOrder ?? false,
          cashRounding:          tenant.posSettings?.cashRounding ?? false,
          roundingIncrement:     tenant.posSettings?.roundingIncrement ?? 1,
          tipsEnabled:           tenant.posSettings?.tipsEnabled ?? false,
          kitchenAlertMins:      tenant.posSettings?.kitchenAlertMins ?? 10,
          loginWithEmployees:    tenant.posSettings?.loginWithEmployees ?? false,
          largeScrollbars:       tenant.posSettings?.largeScrollbars ?? false,
          shareOpenOrders:       tenant.posSettings?.shareOpenOrders ?? false,
          hidePictures:          tenant.posSettings?.hidePictures ?? false,
          showProductImages:     tenant.posSettings?.showProductImages ?? true,
          showCategoryImages:    tenant.posSettings?.showCategoryImages ?? true,
          restrictCategories:    tenant.posSettings?.restrictCategories ?? false,
          sortCartByCategory:    tenant.posSettings?.sortCartByCategory ?? false,
          flexiblePricelists:    tenant.posSettings?.flexiblePricelists ?? false,
          priceControl:          tenant.posSettings?.priceControl ?? false,
          productPriceDisplay:   tenant.posSettings?.productPriceDisplay ?? 'tax_excluded',
          lineDiscounts:         tenant.posSettings?.lineDiscounts ?? true,
          globalDiscounts:       tenant.posSettings?.globalDiscounts ?? false,
          promotionsEnabled:     tenant.posSettings?.promotionsEnabled ?? true,
          maxDiscountPct:        tenant.posSettings?.maxDiscountPct ?? 100,
          requireOpeningCash:    tenant.posSettings?.requireOpeningCash ?? false,
          splitPayments:         tenant.posSettings?.splitPayments ?? true,
          enabledPaymentMethods: tenant.posSettings?.enabledPaymentMethods ?? ['cash','card','bank_transfer','mobile_money'],
          receiptHeader:         tenant.posSettings?.receiptHeader ?? '',
          receiptFooter:         tenant.posSettings?.receiptFooter ?? '',
          showTaxOnReceipt:      tenant.posSettings?.showTaxOnReceipt ?? false,
          taxRate:               tenant.posSettings?.taxRate ?? 0,
          basicReceipt:          tenant.posSettings?.basicReceipt ?? false,
          autoPrintReceipt:      tenant.posSettings?.autoPrintReceipt ?? false,
          receiptCopies:         tenant.posSettings?.receiptCopies ?? 1,
          showOrderNumber:       tenant.posSettings?.showOrderNumber ?? true,
          showCashierName:       tenant.posSettings?.showCashierName ?? true,
          showLoyaltyBalanceAtCheckout: tenant.posSettings?.showLoyaltyBalanceAtCheckout ?? true,
          loyaltyEnabled:        tenant.posSettings?.loyalty?.enabled ?? false,
          loyaltyPointsPerNaira: tenant.posSettings?.loyalty?.pointsPerNaira ?? 0.01,
          loyaltyPointsValue:    tenant.posSettings?.loyalty?.pointsValue ?? 1,
          loyaltyMaxRedemptionPct: tenant.posSettings?.loyalty?.maxRedemptionPct ?? 50,
          loyaltyCard:           tenant.posSettings?.loyalty?.card ?? {},
          coupons:               tenant.posSettings?.coupons ?? [],
          discountCodes:         tenant.posSettings?.discountCodes ?? [],
          promotions:            tenant.posSettings?.promotions ?? [],
          buyXGetY:              tenant.posSettings?.buyXGetY ?? [],
          discountPrograms:      tenant.posSettings?.discountPrograms ?? [],
          nextOrderCoupon:       tenant.posSettings?.nextOrderCoupon ?? null,
          shops:                 tenant.posSettings?.shops ?? [],
          sessionTimeoutMins:    tenant.posSettings?.sessionTimeoutMins ?? 0,
        },
      },
    },
  });
});

// ─── List POS Staff (for login grid) ─────────────────────────────────────────
/**
 * GET /api/pos/staff?tenantSlug=xxx
 * Public — returns staff list for the login grid (no sensitive data)
 */
exports.listPOSStaff = asyncHandler(async (req, res) => {
  const { tenantSlug } = req.query;
  if (!tenantSlug) return res.status(400).json({ success: false, message: 'tenantSlug required' });

  // isActive is a Mongoose virtual (status === 'approved' && subscriptionStatus
  // in active/trialing), not a stored field — so it can't be used in the query
  // filter. Fetch by slug, then evaluate the virtual on the hydrated document.
  const tenant = await Tenant.findOne({ slug: tenantSlug });
  if (!tenant || !tenant.isActive) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  const staff = await User.find({
    tenant:    tenant._id,
    posAccess: true,
    status:    'active',
  }).select('firstName lastName posName role avatar posPinHash posPermissions').lean();

  // Only return whether they have a PIN set, not the hash
  const safeStaff = staff.map(s => {
    const perms = s.posPermissions || [];
    const canRetail    = perms.includes('pos:terminal:retail');
    const canWholesale = perms.includes('pos:terminal:wholesale');
    // Backwards compat: if no terminal permissions explicitly set, allow all
    const hasTerminalPerms = perms.some(p => p.startsWith('pos:terminal:'));
    return {
      _id:       s._id,
      firstName: s.firstName,
      lastName:  s.lastName,
      posName:   s.posName,
      role:      s.role,
      avatar:    s.avatar,
      hasPin:    !!s.posPinHash,
      terminalPermissions: hasTerminalPerms
        ? { retail: canRetail, wholesale: canWholesale }
        : { retail: true, wholesale: true },
    };
  });

  res.json({
    success: true,
    data: {
      staff: safeStaff,
      tenant: {
        _id:          tenant._id,
        slug:         tenant.slug,
        name:         tenant.name,
        primaryColor: tenant.primaryColor,
        logo:         tenant.logo,
      },
    },
  });
});

// ─── Get POS Products (with cache headers) ───────────────────────────────────
/**
 * The most rows this endpoint will ever return. Not a page size: the grid
 * fetches the catalogue ONCE and then searches, filters and paginates it in
 * memory, because an installed POS has to keep selling with no network. So
 * this number is the entire universe of products a terminal can reach.
 *
 * It replaces a `limit = 200` DEFAULT that no caller ever overrode, which made
 * the default the cap: a tenant with 955 POS-visible sub-products could sell
 * 200 of them, and — because search runs over the fetched array — the other
 * 755 answered "no such product" when a cashier typed their names. The sort is
 * best-sellers first, so what vanished was exactly the slow-moving stock
 * nobody can recall and therefore has to look up.
 *
 * 5000 is the same ceiling `/sub-products` already loads happily. It exists so
 * a runaway tenant cannot pull an unbounded collection into memory, not to
 * shape what a normal one sees — and when it does bite, it says so, in the log
 * and on the response. A silent cap is what caused this.
 */
const POS_CATALOGUE_CAP = 5000;

/**
 * GET /api/pos/products
 * Returns products optimised for POS display.
 *
 * There is no hand-rolled ETag here despite what this comment used to claim —
 * Express derives a weak one from the body, so it changes whenever the row
 * count does and no 304 can hand a terminal back a stale, shorter catalogue.
 * The `private, max-age=60` below does mean a terminal can hold the previous
 * catalogue for up to a minute after a deploy.
 */
exports.getPOSProducts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const tenant   = req.tenant;
  const { search, category, limit, shopId, warehouseId: warehouseOverride } = req.query;

  // No limit, a non-number, or a nonsensical one all mean "the whole
  // catalogue" — never "nothing" and never `.limit(NaN)`.
  const requestedLimit = Number(limit);
  const effectiveLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(Math.floor(requestedLimit), POS_CATALOGUE_CAP)
    : POS_CATALOGUE_CAP;

  // warehouseOverride (explicit param) wins; otherwise resolve from shopId.
  //
  // The override is untrusted input and is only honoured when it is actually an
  // id. A client that stringifies a populated `{ _id, name }` ref sends the
  // literal "[object Object]", which used to reach WarehouseStock.warehouse and
  // fail to cast — taking the whole product grid down with it. The POS is an
  // installed PWA, so a terminal can keep sending a bad value from a cached
  // bundle long after the client is fixed; ignoring it here degrades to the
  // shop's own warehouse instead of erroring.
  const validOverride =
    warehouseOverride && mongoose.isValidObjectId(warehouseOverride)
      ? warehouseOverride
      : null;
  const warehouseId = validOverride || await resolveShopWarehouse(tenant, tenantId, shopId);

  // Resolve the auto pricelist id for the active shop so the grid knows the
  // default selection without a separate round-trip / race.
  let resolvedPricelistId = null;
  try {
    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved } = await resolveShopPricelist(tenant, tenantId, shopId);
    resolvedPricelistId = resolved ? String(resolved._id) : null;
  } catch (_) { /* non-fatal — grid falls back to raw prices */ }

  // visibleInPOS is the explicit "show in POS" flag and is the sole gate.
  // Include all statuses except administrative-only ones that mean the product
  // has been deliberately pulled from all channels.
  const EXCLUDED_STATUSES = ['discontinued', 'hidden', 'archived'];

  const query = {
    tenant:       tenantId,
    visibleInPOS: true,
    status:       { $nin: EXCLUDED_STATUSES },
  };

  // NOTE: product.type is on the populated Product ref, not on SubProduct itself.
  // Category and search filters are applied post-populate in JS below.

  // One row past the limit, so truncation is a fact rather than a guess: a
  // result that is exactly `effectiveLimit` long is otherwise indistinguishable
  // from a catalogue that happens to be that size.
  const fetched = await SubProduct.find(query)
    .select([
      // imagesOverride: without it the POS can only ever show the platform
      // product's photo, even for a sub-product with its own uploaded shot.
      'sku', 'product', 'tenant', 'vendor', 'imagesOverride',
      'baseSellingPrice', 'basePriceBeforePricelist', 'costPrice',
      'isOnSale', 'saleType', 'saleStartDate', 'saleEndDate', 'saleDiscountValue',
      'flashSale', 'bundleDeals',
      'availableStock', 'totalStock', 'stockStatus', 'status',
      'sellWithoutSizeVariants', 'defaultSize', 'sizes',
      'visibleInPOS', 'isFeaturedByTenant',
    ].join(' '))
    .populate({
      path:     'product',
      // platformMarkup and platformDiscount are needed for the pricing pipeline.
      // subCategory is needed by the purchases-analytics "Group By" feature.
      select:   'name images type brand category subCategory platformMarkup platformDiscount',
      populate: [
        { path: 'brand',       select: '_id name' },
        { path: 'category',    select: '_id name' },
        { path: 'subCategory', select: '_id name' },
      ],
    })
    // wholesalePrice: the stock-transfer create form defaults each line to the
    // size's wholesale rate (falling back to cost). Omitting it from this
    // projection is silent — every line would just read as cost.
    .populate('sizes', 'displayName sellingPrice costPrice wholesalePrice availableStock stock _id sku barcode')
    .populate({ path: 'vendor', select: 'firstName lastName email posName', strictPopulate: false })
    .sort({ isFeaturedByTenant: -1, totalSold: -1, availableStock: -1 })
    .limit(effectiveLimit + 1)
    .lean();

  const truncated  = fetched.length > effectiveLimit;
  const subProducts = truncated ? fetched.slice(0, effectiveLimit) : fetched;

  if (truncated) {
    console.warn(
      `[POS] catalogue truncated at ${effectiveLimit} rows for tenant ${tenantId}` +
      ' — the terminal searches only what it is sent, so every product beyond' +
      ' this point is unsellable and unfindable from the till.'
    );
  }

  // When the shop is bound to a warehouse, look up per-(subProduct,size) stock
  // so warehouse numbers can override the aggregate below.
  let stockMap = null;
  if (warehouseId) {
    const stockRows = await WarehouseStock.find({
      tenant: tenantId,
      warehouse: warehouseId,
      subProduct: { $in: subProducts.map((sp) => sp._id) },
    }).select('subProduct size currentQuantity').lean();

    stockMap = new Map();
    for (const row of stockRows) {
      const spKey = String(row.subProduct);
      if (!stockMap.has(spKey)) stockMap.set(spKey, new Map());
      stockMap.get(spKey).set(String(row.size), row.currentQuantity);
    }
  }

  // Inject computed platform selling prices so the client never sees raw 0-values
  const enriched = subProducts.map((sp) => {
    const basePricing   = computePOSPricing(sp, null, tenant);
    const basePrice     = basePricing.sellingPrice;
    const originalPrice = basePricing.originalPrice;

    const rawSizes = (sp.sizes || []).filter(Boolean);
    let enrichedSizes = rawSizes.map((size) => {
      const sizePricing = computePOSPricing(sp, size, tenant);
      return {
        ...size,
        sellingPrice:  sizePricing.sellingPrice,
        originalPrice: sizePricing.isOnSale ? sizePricing.originalPrice : null,
      };
    });

    let warehouseAvailableStock = null;

    if (warehouseId) {
      // Warehouse-scoped: stock comes from WarehouseStock, hard-filter zeros.
      const spStock = stockMap.get(String(sp._id)) || new Map();

      if (sp.sellWithoutSizeVariants) {
        const qty = spStock.get(String(sp.defaultSize)) ?? 0;
        if (qty <= 0) return null;
        warehouseAvailableStock = qty;
        enrichedSizes = enrichedSizes.map((s) => ({ ...s, availableStock: qty }));
      } else {
        enrichedSizes = enrichedSizes
          .map((s) => ({ ...s, availableStock: spStock.get(String(s._id)) ?? 0 }))
          .filter((s) => s.availableStock > 0);
        if (enrichedSizes.length === 0) return null;
        warehouseAvailableStock = enrichedSizes.reduce((sum, s) => sum + s.availableStock, 0);
      }
    } else {
      // Normalise size-level availableStock to match the SubProduct aggregate.
      // Mismatches arise when inventory adjustments are made without specifying a
      // size (the service updates SubProduct only, leaving Size docs stale).
      const sizeStockSum = enrichedSizes.reduce((sum, s) => sum + (s.availableStock || 0), 0);
      if (enrichedSizes.length > 0 && !sp.sellWithoutSizeVariants && sizeStockSum !== sp.availableStock) {
        const target = Math.max(0, sp.availableStock);
        if (sizeStockSum === 0) {
          // All sizes at zero — distribute evenly
          const perSize   = Math.floor(target / enrichedSizes.length);
          const remainder = target % enrichedSizes.length;
          enrichedSizes = enrichedSizes.map((s, i) => ({
            ...s,
            availableStock: perSize + (i === 0 ? remainder : 0),
          }));
        } else {
          // Sizes have stock but their sum differs — scale proportionally so the
          // POS sum matches SubProduct.availableStock (source of truth).
          let remaining = target;
          enrichedSizes = enrichedSizes.map((s, i) => {
            const isLast  = i === enrichedSizes.length - 1;
            const share   = (s.availableStock || 0) / sizeStockSum;
            const newStock = isLast
              ? Math.max(0, remaining)
              : Math.max(0, Math.min(remaining, Math.round(share * target)));
            remaining -= newStock;
            return { ...s, availableStock: newStock };
          });
        }
      }
    }

    // Active bundle deals (not expired, sorted best discount first)
    const now = new Date();
    const activeBundles = (sp.bundleDeals || [])
      .filter(bd => bd.active !== false && (!bd.validUntil || new Date(bd.validUntil) >= now))
      .sort((a, b) => (b.discount || 0) - (a.discount || 0));

    return {
      ...sp,
      baseSellingPrice: basePrice,
      originalPrice:    basePricing.isOnSale ? originalPrice : null,
      isOnSale:         basePricing.isOnSale,
      isFlashSale:      basePricing.isFlashSale,
      ...(warehouseId ? { availableStock: warehouseAvailableStock } : {}),
      activeBundles,
      sizes: enrichedSizes,
    };
  }).filter(Boolean);

  // Post-populate filtering (product.type and search cannot be done in the Mongoose query)
  const filtered = enriched.filter((sp) => {
    if (category && sp.product?.type !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        sp.product?.name?.toLowerCase().includes(q) ||
        sp.sku?.toLowerCase().includes(q) ||
        sp.product?.brand?.name?.toLowerCase().includes(q) ||
        sp.sizes?.some((s) => s.displayName?.toLowerCase().includes(q))
      );
    }
    return true;
  });

  res.set('Cache-Control', 'private, max-age=60');
  // `limit`/`truncated` describe the catalogue the client was handed, so a
  // caller can tell a complete one from a clipped one. `total` is the filtered
  // row count and has always been that; it is not the tenant's product count.
  res.json({
    success: true,
    data: {
      products: filtered,
      total: filtered.length,
      limit: effectiveLimit,
      truncated,
      resolvedPricelistId,
    },
  });
});

// ─── Sub-Product metadata (category / subcategory / brand) ───────────────────
/**
 * GET /api/pos/product-meta
 * Lightweight map of every tenant SubProduct → its product's category,
 * subcategory and brand names. Unlike getPOSProducts this is NOT gated by
 * visibleInPOS / status / limit, so purchase analytics can attribute PO lines
 * that reference sub-products not currently sold in POS. Returns _id + names
 * only — no pricing, stock, or sizes.
 */
exports.getPOSProductMeta = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const subProducts = await SubProduct.find({ tenant: tenantId })
    .select('_id product')
    .populate({
      path:     'product',
      select:   'category subCategory brand',
      populate: [
        { path: 'brand',       select: '_id name' },
        { path: 'category',    select: '_id name' },
        { path: 'subCategory', select: '_id name' },
      ],
    })
    .lean();

  const meta = subProducts.map((sp) => {
    const prod = sp.product || {};
    return {
      _id:         String(sp._id),
      categoryId:    prod.category?._id ? String(prod.category._id) : null,
      categoryName:  prod.category?.name || null,
      subCategoryId:   prod.subCategory?._id ? String(prod.subCategory._id) : null,
      subCategoryName: prod.subCategory?.name || null,
      brandId:     prod.brand?._id ? String(prod.brand._id) : null,
      brandName:   prod.brand?.name || null,
    };
  });

  res.set('Cache-Control', 'private, max-age=300');
  res.json({ success: true, data: { meta, total: meta.length } });
});

/**
 * The agreed unit price of every line on a Sales Order loaded into the cart.
 *
 * A quotation is a negotiated, ISSUED offer, so its line prices have to beat
 * today's POS price, the pricelist and the bundle rules — a 10% deal price, a
 * manually overridden line, a price from a pricelist that has since changed, all
 * sit far outside the 1% band `createPOSOrder` allows a cart price. Widening
 * that band was never the answer: it is the tamper guard on a number that
 * arrived from the client. Instead the client sends an ID and the server looks
 * the prices up here, so an agreed price never crosses the wire and never has to
 * be trusted.
 *
 * The price is NET of the line's agreed discount and promotion, per unit:
 *   (unitPrice·qty − lineDiscount − promoDiscount) / qty
 * The till's own per-line discount is a percentage from the dialpad and cannot
 * express a flat ₦ off a line, and per-unit is the only split of a flat discount
 * that stays right when the cashier sells 3 of a quoted 10. Line tax is NOT
 * folded in — POS lines carry their own taxRate and tax on top of this.
 *
 * @returns {Promise<Map<string, number>>} keyed `subProductId_sizeId`, or
 *   `subProductId` when the line is unsized OR when the order names that
 *   sub-product exactly once (so a cart line whose size is unknown still
 *   matches). Two sizes of one product leave the bare key unset: ambiguity
 *   falls through to ordinary pricing rather than picking the cheaper line.
 */
async function resolveLinkedSalesOrderPrices(salesOrderId, tenantId) {
  const prices = new Map();
  if (!salesOrderId || !tenantId) return prices;

  let so = null;
  try {
    so = await SalesOrder.findOne({ _id: salesOrderId, tenant: tenantId })
      .select('items')
      .lean();
  } catch (_) {
    return prices; // a malformed id is not a reason to fail the sale
  }
  if (!so) return prices;

  const { lineTotalOf } = require('../services/salesOrder.service');
  const bySubProduct = new Map();

  for (const line of so.items || []) {
    if (line.lineType && line.lineType !== 'product') continue;
    if (!line.subproduct) continue;
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;

    const net  = lineTotalOf(line) - (Number(line.promoDiscount) || 0);
    const unit = Math.max(0, net / qty);
    const sub  = String(line.subproduct);

    prices.set(line.size ? `${sub}_${String(line.size)}` : sub, unit);
    bySubProduct.set(sub, [...(bySubProduct.get(sub) || []), unit]);
  }

  for (const [sub, units] of bySubProduct) {
    if (units.length === 1 && !prices.has(sub)) prices.set(sub, units[0]);
  }

  return prices;
}

/**
 * Validate a tab-settlement claim against the table it names.
 *
 * Pure — the caller loads the table doc and owns the HTTP mapping. A claim is
 * valid when the table has no open tab (it may have been cleared out-of-band)
 * or when it is still held open by exactly the order being paid for. Anything
 * else means another device got there first, and refusing HERE — before any
 * stock deduction or wallet charge — is what keeps money from moving twice.
 *
 * @returns {{ ok: true, tableName: string } |
 *           { ok: false, status: 404|409, message: string }}
 */
function assertSettleClaim(table, heldOrderId) {
  if (!table) return { ok: false, status: 404, message: 'table not found' };
  if (table.currentTabId && String(table.currentTabId) !== String(heldOrderId)) {
    return { ok: false, status: 409, message: 'this table was settled on another device' };
  }
  return { ok: true, tableName: table.name };
}
exports.assertSettleClaim = assertSettleClaim;

/**
 * Free a table and recall its tab once the sale has actually persisted.
 *
 * Both writes are guarded so they are idempotent: the free only lands while
 * this exact tab still owns the table row, and the recall only touches an
 * order still parked as a hold. Returns whether the free landed — false means
 * the row had already moved on between guard and settlement.
 */
async function settleTableAfterSale({ tableId, heldOrderId, tenantId }) {
  const freed = await POSTable.findOneAndUpdate(
    { _id: tableId, tenant: tenantId, currentTabId: heldOrderId },
    { $set: { status: 'available', currentTabId: null } }
  );
  await Order.updateOne(
    { _id: heldOrderId, ...tenantScope(tenantId), status: 'hold' },
    { $set: { status: 'recalled', paymentStatus: 'cancelled' } }
  );
  return !!freed;
}
exports.settleTableAfterSale = settleTableAfterSale;

// ─── Create POS Order (with atomic stock deduction) ──────────────────────────
/**
 * POST /api/pos/orders
 * Body: { items, customer, paymentMethod, amountTendered, splitPayments, discount, note, sessionId }
 * Atomic stock deduction with $gte guard to prevent overselling.
 */
exports.createPOSOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const staffId  = req.posUser._id;

  const {
    items,            // [{ subProductId, sizeId?, quantity, price, discount?, clientPrice? }]
    customer = {},
    paymentMethod,    // 'cash' | 'card' | 'bank_transfer' | 'mobile_money' | 'split'
    amountTendered = 0,
    splitPayments = [],
    discountType,     // 'percent' | 'fixed'
    discountValue = 0,
    note = '',
    sessionId,
    priceOverrides = {}, // { subProductId+sizeId key: newPrice } — requires pos:price_override
    pricelistId,         // selected pricelist _id — applied to prices at order time
    shopId,              // posSettings.shops._id — resolves a bound warehouse, if any
    cartOriginalSubtotal,// client-computed pre-pricelist subtotal for receipt savings display
    linkedSalesOrderId,  // a quotation/order loaded into the cart — an ID, never a price
    tipAmount: rawTipAmount = 0,           // gratuity added on top of the total
    tableId = null,      // venue table whose tab this sale settles
    heldOrderId = null,  // the held order this settle consumes
  } = req.body;

  if (!items?.length) return res.status(400).json({ success: false, message: 'No items in order' });
  if (!paymentMethod)  return res.status(400).json({ success: false, message: 'Payment method required' });

  // Wallet tender (store credit) needs a saved customer to draw the balance from —
  // a walk-in has no wallet. The actual debit (with an atomic overdraw guard) runs
  // once the order total is known, below.
  if (paymentMethod === 'wallet' && !customer.customerId) {
    return res.status(400).json({ success: false, message: 'Wallet payment requires a saved customer' });
  }

  // Check price override permission
  const hasOverrides = Object.keys(priceOverrides).length > 0;
  if (hasOverrides && !req.posPermissions.includes('pos:price_override')) {
    return res.status(403).json({ success: false, message: 'Price override permission required' });
  }

  // ── Tab settlement claim ───────────────────────────────────────────────────
  // Sending BOTH ids declares "this sale settles that table's tab". It is
  // validated before any stock or wallet moves: a table already settled on
  // another device must refuse here, not after money has been taken. The
  // table's name rides along for the receipt stamp.
  let settledTableName;
  if (tableId && heldOrderId) {
    const table = await POSTable.findOne({ _id: tableId, tenant: tenantId }).lean();
    const claim = assertSettleClaim(table, heldOrderId);
    if (!claim.ok) {
      return res.status(claim.status).json({ success: false, message: claim.message });
    }
    settledTableName = claim.tableName;
  }

  // A saved customer may have an assigned pricelist; it takes top precedence in
  // resolution (it's the per-customer auto-pick) but is still bounded by the
  // allowed set, so a customer can never be charged an off-tenant pricelist.
  let customerPricelistId = null;
  let customerTags = null;
  if (customer.customerId) {
    try {
      const cust = await POSCustomer.findOne({ _id: customer.customerId, tenant: tenantId })
        .select('pricelist tags').lean();
      customerPricelistId = cust?.pricelist ? String(cust.pricelist) : null;
      customerTags = Array.isArray(cust?.tags) ? cust.tags.map(String) : [];
    } catch (_) { /* non-fatal — fall back to shop resolution */ }
  }

  // Resolve the pricelist AUTHORITATIVELY from the shop (and the customer, if
  // assigned). The client may request an override via pricelistId, but it is
  // honored only if it belongs to the allowed set; otherwise we use the
  // auto-resolved pricelist (customer → shop → warehouse → default).
  let selectedPricelist = null;
  try {
    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved, allowed } = await resolveShopPricelist(req.tenant, tenantId, shopId, customerPricelistId, null, customerTags);
    if (pricelistId) {
      const override = allowed.find((p) => String(p._id) === String(pricelistId));
      selectedPricelist = override || resolved || null;
    } else {
      selectedPricelist = resolved || null;
    }
  } catch (_) { /* non-fatal — fall back to DB pricing */ }

  // The agreed price on a loaded quotation, re-read from the database.
  const soLinePrices = await resolveLinkedSalesOrderPrices(linkedSalesOrderId, tenantId);

  // Resolve receipt number early so audit records can reference it
  const orderNumber   = await generateOrderNumber();
  const receiptNumber = await generateReceiptNumber();

  // Read tenant POS settings for stock enforcement
  const allowOverselling = req.tenant?.posSettings?.allowOverselling === true;
  // Warehouse-level policy: negative stock and the batch-tracking master switch.
  const whSettings = await getTenantWarehouseSettings(tenantId);
  const allowNegativeStock = whSettings.allowNegativeStock === true;
  const batchTrackingEnabled = whSettings.batchTrackingEnabled !== false;
  const blockExpiredStock = whSettings.blockExpiredStock === true;
  const fefoPicking = whSettings.fefoPicking === true;

  // Resolve the active shop's bound warehouse. Built-in shops (retail/
  // wholesale) and unbound custom shops fall back to the tenant's default
  // warehouse. When set, stock is sourced from and decremented in
  // WarehouseStock for that warehouse only.
  const warehouseId = await resolveShopWarehouse(req.tenant, tenantId, shopId);

  // Atomic stock deduction with full audit trail
  const deductedItems = [];  // for rollback on failure
  const orderItems    = [];

  try {
    for (const item of items) {
      const { subProductId, sizeId, quantity } = item;
      if (!quantity || quantity < 1) continue;

      // Fetch subproduct for price resolution and order line data
      const sp = await SubProduct.findById(subProductId)
        .select('product sku baseSellingPrice costPrice isOnSale saleType saleStartDate saleEndDate saleDiscountValue flashSale bundleDeals defaultSize sizes')
        .populate('product', 'name images platformMarkup platformDiscount tracksBatch')
        .populate('sizes', 'wholesalePrice isDefault unitsPerPack')
        .lean();

      // Server-side price: run through same pipeline as the website / cart
      const pricing     = computePOSPricing(sp, null, req.tenant);
      const overrideKey = sizeId ? `${subProductId}_${sizeId}` : subProductId;
      let finalPrice    = hasOverrides && priceOverrides[overrideKey] != null
        ? Number(priceOverrides[overrideKey])
        : pricing.sellingPrice;

      // If sized, re-price with size doc for accurate cost
      let sizePricing = pricing;
      let sizeDoc = null;
      if (sizeId) {
        sizeDoc = await Size.findById(sizeId).lean();
        sizePricing   = computePOSPricing(sp, sizeDoc, req.tenant);
        if (!(hasOverrides && priceOverrides[overrideKey] != null)) {
          finalPrice = sizePricing.sellingPrice;
        }
      }

      // Capture pre-pricelist unit price for receipt savings display.
      // Always uses the system-computed price, not a cashier override,
      // so "original" reflects the true baseline for pricelist comparison.
      const originalUnitPrice = sizePricing.sellingPrice;

      // Deduct stock (throws on insufficient stock unless overselling is allowed)
      const deductedDoc = await deductStock({
        subProductId,
        sizeId:          sizeId || null,
        quantity,
        tenantId,
        staffId,
        receiptNumber,
        productId:       sp?.product?._id,
        finalPrice,
        costPrice:       sizePricing.costPrice,
        allowOverselling,
        allowNegativeStock,
        warehouseId,
        defaultSizeId:   sp?.defaultSize || null,
        tracksBatch:     batchTrackingEnabled && !!sp?.product?.tracksBatch,
        blockExpiredStock,
        fefoPicking,
      });

      deductedItems.push({
        type:          sizeId ? 'size' : 'subproduct',
        sizeId:        sizeId || null,
        subProductId,
        quantity,
        defaultSizeId: sp?.defaultSize || null,
        batchAllocations: deductedDoc?.batchAllocations || [],
      });

      // ── Flash sale: decrement remainingQuantity (best-effort, non-blocking) ──
      const fsNow = new Date();
      const fsDoc = sp.flashSale;
      const fsApplied =
        fsDoc?.isActive === true &&
        (fsDoc?.discountPercentage ?? 0) > 0 &&
        (!fsDoc.startDate || fsNow >= new Date(fsDoc.startDate)) &&
        (!fsDoc.endDate   || fsNow <= new Date(fsDoc.endDate))   &&
        (fsDoc.remainingQuantity == null || fsDoc.remainingQuantity > 0);

      if (fsApplied && fsDoc.remainingQuantity != null) {
        SubProduct.findOneAndUpdate(
          { _id: subProductId, 'flashSale.remainingQuantity': { $gte: quantity } },
          { $inc: { 'flashSale.remainingQuantity': -quantity } }
        ).catch(() => {});
      }

      // ── Apply pricelist price rules sequentially (shared with /sales — pricelistPricing.service) ──
      let appliedPlRuleSnapshot = null;
      const sortedPriceRules = findMatchingPriceRules(selectedPricelist?.rules, subProductId, quantity);
      // Wholesale markup base: the size's wholesale price (or the subproduct
      // default size's) when present.
      const wholesaleBasis = (() => {
        if (sizeId && sizeDoc?.wholesalePrice > 0) return Number(sizeDoc.wholesalePrice) || 0;
        const sizes = Array.isArray(sp?.sizes) ? sp.sizes : [];
        const def = sizes.find((s) => s.isDefault)?.wholesalePrice;
        if (Number(def) > 0) return Number(def) || 0;
        return Number(sizes.find((s) => Number(s.wholesalePrice) > 0)?.wholesalePrice) || 0;
      })();
      finalPrice = applyPriceRules(finalPrice, sizePricing.costPrice || 0, sortedPriceRules, wholesaleBasis);
      if (sortedPriceRules.length > 0) {
        appliedPlRuleSnapshot = {
          ruleId:    sortedPriceRules[0]._id,
          priceType: sortedPriceRules[0].priceType,
          sequence:  sortedPriceRules[0].sequence,
        };
      }

      // ── Bundle deals: find best qualifying deal for this line quantity (shared) ──
      const sizeUnitsPerPack = (() => {
        if (sizeDoc?.unitsPerPack > 1) return sizeDoc.unitsPerPack;
        const sizes = Array.isArray(sp?.sizes) ? sp.sizes : [];
        const def = sizes.find((s) => s.isDefault)?.unitsPerPack;
        if (def > 1) return def;
        return sizes.find((s) => (s.unitsPerPack || 0) > 1)?.unitsPerPack || 1;
      })();
      const bestBundle = pickBestBundle(sp.bundleDeals, selectedPricelist?.rules, quantity, subProductId, {
        price: finalPrice,
        costPrice: sizePricing.costPrice || 0,
        wholesalePrice: wholesaleBasis,
        unitsPerPack: sizeUnitsPerPack,
      });

      // ── Effective unit price (some bundle types override finalPrice) ──────────
      const bundleOverride   = applyBundleOverride(finalPrice, bestBundle, sizePricing.costPrice || 0, sizePricing.originalPrice, wholesaleBasis);
      let effectivePrice      = bundleOverride.price;
      let bundleOverridePrice = bundleOverride.overridden;

      // ── The agreed price on a loaded quotation ────────────────────────────
      // Beats the pricelist, the bundle rules and the cart — but NOT an explicit
      // cashier override, which is a permissioned, deliberate act. It is safe to
      // apply without a tolerance band because it was read from the database
      // (resolveLinkedSalesOrderPrices), not sent by the till.
      const soUnitPrice = (hasOverrides && priceOverrides[overrideKey] != null)
        ? null
        : soLinePrices.get(overrideKey)
          ?? (sizeId ? soLinePrices.get(String(subProductId)) : undefined)
          ?? null;

      if (soUnitPrice != null) {
        effectivePrice      = soUnitPrice;
        // The agreed price already IS the negotiated discount — a bundle
        // discount on top of it would give the deal away twice.
        bundleOverridePrice = true;
      } else if (item.clientPrice != null && Number(item.clientPrice) > 0) {
        // If the client sent the effectivePrice its cart displayed (computed after
        // pricelist + bundle rules), reconcile toward it — but only within a small
        // tolerance of the server's own computation. Client and server share the
        // same rule engine, so a matching cart differs at most by rounding; a
        // larger gap means a stale client cache or a tampered payload, and the
        // server-computed pricelist price wins.
        const cp = Number(item.clientPrice);
        const tolerance = Math.max(1, effectivePrice * 0.01);
        if (Math.abs(cp - effectivePrice) <= tolerance) {
          effectivePrice = cp;
        } else {
          console.warn(
            `[POS] clientPrice ${cp} rejected for ${subProductId} — server price ${effectivePrice} (pricelist ${selectedPricelist?._id || 'none'})`
          );
        }
      }

      // Item-level cashier discount (always percentage from the dialpad)
      const lineGross      = effectivePrice * quantity;
      const itemDiscPct    = Math.max(0, Math.min(100, item.discount || 0));
      const itemDiscAmt    = parseFloat((lineGross * itemDiscPct / 100).toFixed(2));

      // Bundle discount amount (only for percentage / fixed types; override types already set effectivePrice)
      const bundleDiscAmt = computeBundleLineDiscount(bestBundle, lineGross, quantity, itemDiscAmt, bundleOverridePrice);

      // Compute per-line revenue fields required by Order schema
      const itemDiscountAmount = parseFloat(Math.min(lineGross, itemDiscAmt + bundleDiscAmt).toFixed(2));
      const lineSubtotal       = parseFloat((lineGross - itemDiscountAmount).toFixed(2));

      const tenantRevShare = sizePricing.revenueModel === 'commission'
        ? parseFloat((lineSubtotal * (1 - sizePricing.commissionPct / 100)).toFixed(2))
        : parseFloat((sizePricing.costPrice * quantity).toFixed(2));

      orderItems.push({
        product:               sp?.product?._id || subProductId,
        subproduct:            subProductId,
        size:                  (warehouseId ? (sizeId || sp?.defaultSize) : sizeId) || undefined,
        warehouse:             warehouseId || undefined,
        quantity,
        batchAllocations:      deductedDoc?.batchAllocations || [],
        priceAtPurchase:       effectivePrice,
        originalPriceAtPurchase: originalUnitPrice,
        itemSubtotal:          lineSubtotal,
        discountAmount:        itemDiscountAmount,
        appliedPricelistRule: appliedPlRuleSnapshot ? {
          ...appliedPlRuleSnapshot,
          discountAmount: itemDiscountAmount,
        } : undefined,
        vendorPriceAtPurchase: sizePricing.costPrice,
        wholesalePriceAtPurchase: wholesaleBasis,
        tenantRevenueShare:    tenantRevShare,
        platformCommission:    parseFloat((lineSubtotal - tenantRevShare).toFixed(2)),
        tenantRevenueModel:    sizePricing.revenueModel,
        revenueRateAtPurchase: sizePricing.revenueModel === 'commission' ? sizePricing.commissionPct : sizePricing.markupPct,
        tenant:                tenantId,
        _name:    sp?.product?.name || 'Product',
        _variant: item.variant || '',
        _sku:     item.sku || sp?.sku || '',
        _soPriced: soUnitPrice != null,
      });
    }
  } catch (stockErr) {
    await rollbackDeductedStock();
    return res.status(409).json({ success: false, message: stockErr.message });
  }

  // Restore every already-deducted stock line — used on a stock failure above and,
  // below, when a wallet-tendered sale can't be paid for (so we never leave stock
  // committed for a sale that didn't go through).
  async function rollbackDeductedStock() {
    for (const d of deductedItems) {
      if (warehouseId) {
        await returnStock(
          { warehouseId, subProduct: d.subProductId, size: d.sizeId || d.defaultSizeId, quantity: d.quantity,
            batchAllocations: d.batchAllocations },
          staffId,
          tenantId
        ).catch(() => {});
      } else if (d.sizeId) {
        await Size.findByIdAndUpdate(d.sizeId, { $inc: { availableStock: d.quantity, stock: d.quantity } });
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      } else {
        await SubProduct.findByIdAndUpdate(d.subProductId, { $inc: { availableStock: d.quantity, totalStock: d.quantity } });
      }
    }
  }

  // ── Cross-product Buy-X-Get-Y bundle rules (cart-wide pass) ────────────────
  // Per-line pricing above can't see the rest of the cart, so "buy N of A,
  // discount B" rules are applied here: overridePrice types replace the
  // target's unit price; percentage/fixed types add to the line discount.
  // Revenue-split fields are re-derived from the adjusted line subtotal.
  const crossBundleAdjs = applyCartBundles(
    orderItems.map((it) => ({
      subProductId: it.subproduct,
      quantity:     it.quantity,
      price:        it.priceAtPurchase,
      costPrice:    it.vendorPriceAtPurchase,
      wholesalePrice: it.wholesalePriceAtPurchase || 0,
      originalPrice: it.originalPriceAtPurchase,
    })),
    selectedPricelist?.rules
  );
  for (const adj of crossBundleAdjs) {
    const it = orderItems[adj.lineIndex];
    if (!it) continue;
    // A line priced from a loaded quotation is already the negotiated price;
    // a cart-wide bundle rule must not discount it a second time.
    if (it._soPriced) continue;
    if (adj.overridePrice != null && adj.overridePrice > 0) {
      it.priceAtPurchase = adj.overridePrice;
    } else if (!(adj.discountAmount > 0)) {
      continue;
    }
    const lineGross = it.priceAtPurchase * it.quantity;
    it.discountAmount = parseFloat(
      Math.min(lineGross, (it.discountAmount || 0) + (adj.discountAmount || 0)).toFixed(2)
    );
    it.itemSubtotal = parseFloat((lineGross - it.discountAmount).toFixed(2));
    if (it.tenantRevenueModel === 'commission') {
      it.tenantRevenueShare = parseFloat(
        (it.itemSubtotal * (1 - (it.revenueRateAtPurchase || 0) / 100)).toFixed(2)
      );
    }
    it.platformCommission = parseFloat((it.itemSubtotal - it.tenantRevenueShare).toFixed(2));
  }

  // Compute totals — itemSubtotal already has item-level discount applied
  const subtotal = orderItems.reduce((s, it) => s + it.itemSubtotal, 0);
  // Gross before any per-item discounts (pricelist-effective price × qty).
  // Used to compute pricelist savings against the client's pre-pricelist subtotal.
  const grossBeforeDisc = orderItems.reduce(
    (s, it) => s + it.priceAtPurchase * it.quantity, 0
  );
  const originalSubtotal = Number(cartOriginalSubtotal) > 0
    ? Number(cartOriginalSubtotal)
    : grossBeforeDisc;
  const pricelistSavings = Math.max(0, originalSubtotal - grossBeforeDisc);

  let orderDiscountAmount = 0;
  if (discountValue > 0) {
    orderDiscountAmount = discountType === 'fixed'
      ? Math.min(discountValue, subtotal)
      : subtotal * discountValue / 100;
  }

  // ── Cart spend-threshold rules (pricelist cart-level discount) ─────────────
  // Qualification and stacking are both computed off the pre-cashier-discount
  // subtotal, matching the client cart display.
  const thresholdRules = findCartThresholdRules(selectedPricelist?.rules, subtotal);
  const cartThresholdDiscount = parseFloat(
    computeCartThresholdDiscount(thresholdRules, subtotal).toFixed(2)
  );

  const total = Math.max(0, subtotal - orderDiscountAmount - cartThresholdDiscount);

  // ── Tip (gratuity) ─────────────────────────────────────────────────────────
  // A tip is money for the staff, not income from the goods. It is added on top
  // of `total` and never folded into subtotal, discountTotal or the per-item
  // revenue split — otherwise the tenant's commission and the platform's cut
  // would both be computed on a gratuity the customer chose to leave.
  const tipsEnabled = req.tenant?.posSettings?.tipsEnabled ?? false;
  const tipAmount = tipsEnabled
    ? Math.max(0, parseFloat((Number(rawTipAmount) || 0).toFixed(2)))
    : 0;

  // ── Cash rounding ──────────────────────────────────────────────────────────
  // Recomputed here from the tenant's own increment rather than trusted from the
  // till: the rounding delta is real money, and a client that sent its own would
  // be setting the price. Only a cash tender rounds — card and transfer settle
  // the exact figure, so rounding them would leave the books off by the delta.
  const cashRoundingEnabled = req.tenant?.posSettings?.cashRounding ?? false;
  const roundingIncrement = req.tenant?.posSettings?.roundingIncrement ?? 1;
  const payableBeforeRounding = total + tipAmount;
  let roundingAmount = 0;
  if (cashRoundingEnabled && paymentMethod === 'cash' && roundingIncrement > 1) {
    const rounded = Math.round(payableBeforeRounding / roundingIncrement) * roundingIncrement;
    roundingAmount = parseFloat((rounded - payableBeforeRounding).toFixed(2));
  }
  const payableTotal = parseFloat((payableBeforeRounding + roundingAmount).toFixed(2));

  // Determine active session — prefer the caller's terminal type
  const orderTerminal = ['retail', 'wholesale'].includes(req.body.terminalType)
    ? req.body.terminalType
    : 'retail';

  let session = null;
  if (sessionId) {
    session = await POSSession.findOne({ _id: sessionId, tenant: tenantId, status: 'open' });
  }
  if (!session) {
    session = await POSSession.findOne({ tenant: tenantId, status: 'open', terminalType: orderTerminal })
      .sort({ openedAt: -1 });
  }

  // ── Wallet tender ──
  // Charge the customer's stored-value wallet for the order total. The debit is an
  // atomic, guarded $inc (see wallet.service) so a balance that's too low blocks
  // the sale here — after which we roll the just-deducted stock back. A zero-total
  // sale (fully discounted) charges nothing.
  let walletTx = null;
  if (paymentMethod === 'wallet' && payableTotal > 0) {
    const walletResult = await mutateWallet({
      owner: {
        Model: POSCustomer,
        ownerType: 'POSCustomer',
        ownerId: customer.customerId,
        filter: { _id: customer.customerId, tenant: tenantId },
      },
      tenantId,
      value: { type: 'debit', amount: payableTotal, reason: `POS sale — receipt ${receiptNumber}` },
      reference: receiptNumber,
      createdBy: staffId,
    });
    if (!walletResult.ok) {
      await rollbackDeductedStock();
      return res.status(walletResult.status === 404 ? 404 : 409)
        .json({ success: false, message: walletResult.message });
    }
    walletTx = walletResult.tx;
  }

  let order;
  try {
    order = await Order.create({
    orderNumber,                          // required unique string
    tenant:        tenantId,
    source:        'pos',
    receiptNumber,
    posSessionId:  session?._id || null,
    posStaff:      staffId,
    items:         orderItems,
    subtotal,
    shippingFee:   0,
    totalAmount:   payableTotal,          // goods total + tip ± cash rounding
    tipAmount,
    roundingAmount,
    discountTotal: (orderDiscountAmount || 0) + (cartThresholdDiscount || 0),
    paymentMethod,
    paymentStatus: 'paid',
    paymentDetails: {
      reference: receiptNumber,
      paidAt:    new Date().toISOString(),
      channel:   'pos',
      // Snapshot customer info for receipt/history display
      customer: {
        firstName:  customer.firstName  || 'Walk-in',
        lastName:   customer.lastName   || 'Customer',
        phone:      customer.phone      || '',
        customerId: customer.customerId || null,
      },
      ...(paymentMethod === 'cash'  && { amount: amountTendered, change: Math.max(0, amountTendered - payableTotal) }),
      ...(paymentMethod === 'split' && { splitPayments }),
      ...(settledTableName ? { tableName: settledTableName } : {}),
    },
    status:                  'confirmed',
    ageVerifiedAtOrderTime:  true,
    placedAt:                new Date(),
    appliedPricelist: selectedPricelist ? {
      pricelistId:   selectedPricelist._id,
      pricelistName: selectedPricelist.name || '',
      thresholdDiscount: cartThresholdDiscount || 0,
    } : undefined,
    });
  } catch (orderErr) {
    // The order failed to persist. Undo any wallet charge (append a compensating
    // credit — the ledger is never edited) and restore the stock, so a failed sale
    // leaves balance, ledger and inventory all consistent.
    if (walletTx) {
      await mutateWallet({
        owner: {
          Model: POSCustomer,
          ownerType: 'POSCustomer',
          ownerId: customer.customerId,
          filter: { _id: customer.customerId, tenant: tenantId },
        },
        tenantId,
        value: { type: 'refund', amount: payableTotal, reason: `Reversed — failed POS sale ${receiptNumber}` },
        reference: receiptNumber,
        createdBy: staffId,
      }).catch(() => {});
    }
    await rollbackDeductedStock();
    throw orderErr;
  }

  // Link the wallet debit to the now-persisted order (best-effort; the receipt
  // number on the tx already ties the two together).
  if (walletTx) {
    WalletTransaction.updateOne({ _id: walletTx._id }, { $set: { relatedOrder: order._id } })
      .catch(err => console.error('[Wallet] link tx to order failed:', err.message));
  }

  // Back-link InventoryMovement records to this order (non-blocking)
  InventoryMovement.updateMany(
    { reference: receiptNumber, tenant: tenantId, relatedOrder: { $exists: false } },
    { $set: { relatedOrder: order._id } }
  ).catch(err => console.error('[Inventory] back-link movements failed:', err.message));

  // ── Table settlement ───────────────────────────────────────────────────────
  // Freeing the table is part of the same success path as the sale. The
  // currentTabId match inside settleTableAfterSale makes this idempotent:
  // settling twice, or settling a tab that moved, frees nothing. Best-effort —
  // the sale has persisted and money has moved, so a hiccup here is logged,
  // never fatal.
  if (tableId && heldOrderId && settledTableName !== undefined) {
    await settleTableAfterSale({ tableId, heldOrderId, tenantId })
      .catch(err => console.error('[POS] free table failed:', err.message));
  }

  // Update session stats atomically
  if (session) {
    // Session money movement is what the drawer actually took, so it counts the
    // tip and the rounding delta too. Using the goods-only `total` here would
    // leave the till short by exactly the gratuity at closing control.
    const sessionInc = {
      orderCount: 1,
      totalSales: payableTotal,
      ...(paymentMethod === 'cash'          && { cashSales:        payableTotal }),
      ...(paymentMethod === 'card'          && { cardSales:        payableTotal }),
      ...(paymentMethod === 'bank_transfer' && { transferSales:    payableTotal }),
      ...(paymentMethod === 'mobile_money'  && { mobileMoneySales: payableTotal }),
    };
    // For split payments, distribute sales across methods
    if (paymentMethod === 'split' && splitPayments?.length) {
      for (const sp of splitPayments) {
        if (sp.method === 'cash')          sessionInc.cashSales        = (sessionInc.cashSales        || 0) + sp.amount;
        if (sp.method === 'card')          sessionInc.cardSales        = (sessionInc.cardSales        || 0) + sp.amount;
        if (sp.method === 'bank_transfer') sessionInc.transferSales    = (sessionInc.transferSales    || 0) + sp.amount;
        if (sp.method === 'mobile_money')  sessionInc.mobileMoneySales = (sessionInc.mobileMoneySales || 0) + sp.amount;
      }
      delete sessionInc.cashSales; // prevent double-count on non-split path
      // Recalculate from split totals only
      const splitTotals = {};
      for (const sp of splitPayments) {
        if (sp.method === 'cash')          splitTotals.cashSales        = (splitTotals.cashSales        || 0) + sp.amount;
        if (sp.method === 'card')          splitTotals.cardSales        = (splitTotals.cardSales        || 0) + sp.amount;
        if (sp.method === 'bank_transfer') splitTotals.transferSales    = (splitTotals.transferSales    || 0) + sp.amount;
        if (sp.method === 'mobile_money')  splitTotals.mobileMoneySales = (splitTotals.mobileMoneySales || 0) + sp.amount;
      }
      Object.assign(sessionInc, splitTotals);
    }
    // Update theoretical balances for each payment method
    const methodUpdates = {};
    const effectivePayments = paymentMethod === 'split'
      ? splitPayments
      : [{ method: paymentMethod, amount: payableTotal }];
    for (const ep of effectivePayments) {
      methodUpdates[`methodBalances.$[el_${ep.method}].theoretical`] = ep.amount;
    }
    await POSSession.findByIdAndUpdate(
      session._id,
      { $inc: sessionInc }
    );
    // Update theoretical per-method balance individually
    for (const ep of effectivePayments) {
      await POSSession.findOneAndUpdate(
        { _id: session._id, 'methodBalances.method': ep.method },
        { $inc: { 'methodBalances.$.theoretical': ep.amount } }
      );
    }
  }

  // Build receipt-friendly items (merge schema fields with display-only fields)
  const receiptItems = orderItems.map((it) => ({
    name:            it._name,
    variant:         it._variant,
    sku:             it._sku,
    quantity:        it.quantity,
    priceAtPurchase: it.priceAtPurchase,
    itemSubtotal:    it.itemSubtotal,
    discountAmount:  it.discountAmount,
  }));

  res.status(201).json({
    success: true,
    data: {
      order: {
        _id:           order._id,
        orderNumber:   order.orderNumber,
        receiptNumber: order.receiptNumber,
        total:         order.totalAmount,
        subtotal:      subtotal,
        originalSubtotal:  originalSubtotal,
        pricelistSavings:  pricelistSavings > 0 ? pricelistSavings : undefined,
        pricelistName:     selectedPricelist?.name || undefined,
        thresholdDiscount: cartThresholdDiscount > 0 ? cartThresholdDiscount : undefined,
        discountTotal: orderDiscountAmount || 0,
        tipAmount:      order.tipAmount || 0,
        roundingAmount: order.roundingAmount || 0,
        paymentMethod: order.paymentMethod,
        splitPayments: paymentMethod === 'split' ? splitPayments : undefined,
        amountTendered: paymentMethod === 'split'
          ? (amountTendered || 0)
          : paymentMethod === 'cash' ? amountTendered : payableTotal,
        change:        paymentMethod === 'split'
          ? Math.max(0, (amountTendered || 0) - payableTotal)
          : paymentMethod === 'cash' ? Math.max(0, amountTendered - payableTotal) : 0,
        items:         receiptItems,
        note:          note || '',
        tableName:     settledTableName || undefined,
        placedAt:      order.placedAt,
        posStaff:      staffId,
        appliedPricelist: order.appliedPricelist,
      },
    },
  });

  // Other terminals and dashboards on this room refresh their live view.
  // The selling device learns about its own sale from the response above, not
  // from its own echo — receiving both is harmless (idempotent refetch).
  if (session) {
    emitToTerminal(req, tenantId, session.terminalType, 'order:created', {
      sessionId:     session._id,
      terminal:      session.terminalType,
      orderId:       order._id,
      receiptNumber: order.receiptNumber,
      total:         payableTotal,
      paymentMethod,
    });
  }
});

// Credit a POS customer's wallet back when a wallet-paid sale is refunded or
// voided. POS orders always carry the customer on paymentDetails.customer.customerId
// (a POSCustomer), so the wallet owner is unambiguous. Best-effort: the refund /
// void itself has already committed, so a wallet hiccup is logged, not fatal. The
// amount is rounded to a whole naira and a non-positive amount is a no-op.
async function creditWalletRefund({ order, tenantId, amount, reference, reason, staffId }) {
  const customerId = order.paymentDetails?.customer?.customerId;
  const amt = Math.round(Number(amount) || 0);
  if (!customerId || amt <= 0) return;
  await mutateWallet({
    owner: {
      Model: POSCustomer,
      ownerType: 'POSCustomer',
      ownerId: customerId,
      filter: { _id: customerId, tenant: tenantId },
    },
    tenantId,
    value: { type: 'refund', amount: amt, reason },
    reference,
    relatedOrder: order._id,
    createdBy: staffId,
  }).catch((err) => console.error('[Wallet] refund credit failed:', err.message));
}

// Reverse the loyalty points a POS sale earned/redeemed when it is fully refunded or
// voided, mirroring creditWalletRefund. The order's loyalty rows (earn/redeem, plus
// any prior reversal) carry relatedOrder, so we net them with loyaltyDelta and write
// one compensating 'adjustment' that zeroes the order out — making this idempotent: a
// second call (e.g. void after a full refund) finds a net of 0 and does nothing.
// Best-effort: the refund/void itself has already committed, so a points hiccup is
// logged, not fatal. The atomic guard blocks a reversal that would overdraw.
async function reverseLoyaltyForOrder({ order, tenantId, reference, reason, staffId }) {
  const customerId = order.paymentDetails?.customer?.customerId;
  if (!customerId) return;

  const rows = await LoyaltyTransaction.find({
    tenant: tenantId,
    ownerType: 'POSCustomer',
    owner: customerId,
    relatedOrder: order._id,
  }).select('type points').lean();

  const net = rows.reduce((s, r) => s + loyaltyDelta(r.type, r.points), 0);
  if (net === 0) return; // nothing earned/redeemed, or already reversed

  await mutateLoyalty({
    owner: {
      Model: POSCustomer,
      ownerType: 'POSCustomer',
      ownerId: customerId,
      filter: { _id: customerId, tenant: tenantId },
    },
    tenantId,
    value: { type: 'adjustment', points: -net, reason },
    reference,
    relatedOrder: order._id,
    createdBy: staffId,
  }).catch((err) => console.error('[Loyalty] reversal failed:', err.message));
}

// ─── Refund (item-level) ──────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/:id/refund
 * Body: { items: [{ orderItemIndex, quantity, discPct, unitPrice, restock, reason }], reason, refundPaymentMethod }
 * Requires: pos:refund permission
 * Optionally restores stock, creates RTN-YYYYMMDD-XXXX record
 */
exports.refundPOSOrder = asyncHandler(async (req, res) => {
  const { items: refundItems = [], reason = '', refundPaymentMethod } = req.body;
  if (!refundItems.length) return res.status(400).json({ success: false, message: 'No items to refund' });

  // Support both POS-token context (req.posUser) and admin-token context (req.user)
  const performer = req.posUser || req.user;
  if (!performer) return res.status(401).json({ success: false, message: 'Authentication required' });

  const order = await Order.findOne({ _id: req.params.id, 'items.tenant': req.tenant?._id });
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.isVoided) return res.status(400).json({ success: false, message: 'Cannot refund a voided order' });

  // Build a map of already-refunded qty per item index to prevent double-refund
  const alreadyRefunded = {};
  for (const refund of order.refunds) {
    for (const line of refund.items) {
      const idx = line.orderItemIndex;
      if (idx != null) alreadyRefunded[idx] = (alreadyRefunded[idx] || 0) + (line.quantity || 0);
    }
  }

  const returnNumber = await generateReturnNumber();
  let   totalRefunded = 0;
  const refundLines   = [];
  const errors        = [];

  for (const ri of refundItems) {
    const { orderItemIndex, quantity, discPct = 0, unitPrice: overridePrice, restock = true, reason: lineReason } = ri;
    const orderItem = order.items[orderItemIndex];
    if (!orderItem) { errors.push(`Item at index ${orderItemIndex} not found`); continue; }

    // Check quantity is valid
    const alreadyQty  = alreadyRefunded[orderItemIndex] || 0;
    const maxRefundQty = orderItem.quantity - alreadyQty;
    if (quantity < 1) { errors.push(`Quantity must be at least 1`); continue; }
    if (quantity > maxRefundQty) {
      errors.push(
        `Cannot refund ${quantity} of "${orderItem.product?.name || 'item'}" — only ${maxRefundQty} unit(s) remain refundable`
      );
      continue;
    }

    // Validate discount %
    const safeDiscPct = Math.min(Math.max(0, Number(discPct) || 0), 100);

    // Resolve per-unit refund price:
    //   1. Use override if cashier has pos:price_override permission (or is an admin)
    //   2. Otherwise use the original purchase price
    const hasPriceOverride = req.posPermissions?.includes('pos:price_override')
      || req.user?.role === 'superadmin'
      || req.user?.role === 'admin';
    const baseUnitPrice    = orderItem.priceAtPurchase ?? 0;
    const refundUnitPrice  = (hasPriceOverride && overridePrice > 0)
      ? Number(overridePrice)
      : baseUnitPrice;

    // Refund amount = unit price × qty × (1 − disc%)
    const lineAmount = parseFloat((refundUnitPrice * quantity * (1 - safeDiscPct / 100)).toFixed(2));
    totalRefunded   += lineAmount;

    // Restore stock only if restock flag is true (Odoo-style: cashier controls this)
    if (restock !== false) {
      const lineWarehouseId = orderItem.warehouse ? orderItem.warehouse.toString() : null;
      let lineDefaultSizeId = null;
      if (lineWarehouseId && !orderItem.size) {
        const spDoc = await SubProduct.findById(orderItem.subproduct).select('defaultSize').lean();
        lineDefaultSizeId = spDoc?.defaultSize || null;
      }
      // Restore only `quantity` units back to the exact batches they were sold
      // from, drawn from the front of the stored allocations (handles partial
      // refunds). WarehouseStock remains the authoritative total either way.
      let refundAllocations = null;
      if (lineWarehouseId && Array.isArray(orderItem.batchAllocations) && orderItem.batchAllocations.length) {
        let remaining = quantity;
        refundAllocations = [];
        for (const a of orderItem.batchAllocations) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, a.quantity || 0);
          if (take <= 0) continue;
          refundAllocations.push({ batch: a.batch, quantity: take });
          remaining -= take;
        }
      }
      await restoreStock({
        subProductId: orderItem.subproduct?.toString() || orderItem.subproduct,
        sizeId:       orderItem.size ? orderItem.size.toString() : null,
        quantity,
        tenantId:     req.tenant?._id,
        staffId:      performer._id,
        returnNumber,
        productId:    orderItem.product || undefined,
        unitPrice:    refundUnitPrice,
        warehouseId:    lineWarehouseId,
        defaultSizeId:  lineDefaultSizeId,
        batchAllocations: refundAllocations,
      });
    }

    refundLines.push({
      orderItemIndex,
      quantity,
      unitPrice: refundUnitPrice,
      discPct:   safeDiscPct,
      amount:    lineAmount,
      restock:   restock !== false,
      reason:    lineReason || undefined,
    });
  }

  if (errors.length && refundLines.length === 0) {
    return res.status(400).json({ success: false, message: errors.join('; ') });
  }

  // Record the refund
  order.refunds.push({
    receiptNumber: returnNumber,
    items:         refundLines,
    totalRefunded: parseFloat(totalRefunded.toFixed(2)),
    reason,
    refundedBy:    performer._id,
    refundedAt:    new Date(),
    paymentMethod: refundPaymentMethod || undefined,
  });

  // Update payment status based on cumulative refund vs original total
  const cumulativeRefunded = order.refunds.reduce((s, r) => s + (r.totalRefunded || 0), 0);
  if (cumulativeRefunded >= order.totalAmount) {
    order.paymentStatus = 'refunded';
    order.status        = 'refunded';
  } else if (cumulativeRefunded > 0) {
    order.paymentStatus = 'partially_refunded';
  }

  await order.save();

  // Settle a wallet refund: when the refund is going to store credit — explicitly,
  // or by default when the sale itself was wallet-paid — credit the refunded amount
  // back to the customer's wallet as an append-only ledger row.
  const refundToWallet =
    refundPaymentMethod === 'wallet' ||
    (!refundPaymentMethod && order.paymentMethod === 'wallet');
  if (refundToWallet) {
    await creditWalletRefund({
      order,
      tenantId: req.tenant?._id,
      amount: totalRefunded,
      reference: returnNumber,
      reason: `Refund — ${returnNumber}`,
      staffId: performer._id,
    });
  }

  // Once the sale is fully refunded, unwind its loyalty earn/redeem (idempotent).
  if (cumulativeRefunded >= order.totalAmount) {
    await reverseLoyaltyForOrder({
      order,
      tenantId: req.tenant?._id,
      reference: returnNumber,
      reason: `Reversed — refund ${returnNumber}`,
      staffId: performer._id,
    });
  }

  // Back-link all InventoryMovement records created for this return to the order
  InventoryMovement.updateMany(
    { reference: returnNumber, tenant: req.tenant?._id },
    { relatedOrder: order._id }
  ).catch(err => console.error('[Inventory] POS refund back-link failed:', err.message));

  const refundRecord = order.refunds[order.refunds.length - 1];

  res.json({
    success: true,
    data: {
      returnNumber,
      totalRefunded:     parseFloat(totalRefunded.toFixed(2)),
      cumulativeRefunded: parseFloat(cumulativeRefunded.toFixed(2)),
      paymentStatus:     order.paymentStatus,
      refundLines,
      refundRecord: {
        receiptNumber: refundRecord.receiptNumber,
        items:         refundRecord.items,
        totalRefunded: refundRecord.totalRefunded,
        reason:        refundRecord.reason,
        refundedAt:    refundRecord.refundedAt,
        paymentMethod: refundRecord.paymentMethod,
      },
      warnings:          errors.length ? errors : undefined,
      order: { _id: order._id, receiptNumber: order.receiptNumber },
    },
  });
});

// ─── Void entire sale ─────────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/:id/void
 * Body: { reason }
 * Requires: pos:void permission
 * Restores all stock, marks order as voided
 */
exports.voidPOSOrder = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const order = await Order.findOne({ _id: req.params.id, ...tenantScope(req.tenant?._id) });
  if (!order)          return res.status(404).json({ success: false, message: 'Order not found' });
  if (order.isVoided)  return res.status(400).json({ success: false, message: 'Already voided' });

  // Restore all stock with full audit trail
  const voidNumber = `VOID-${order.receiptNumber || order.orderNumber}`;
  for (const item of order.items) {
    if (!item.subproduct && !item.size) continue;
    const lineWarehouseId = item.warehouse ? item.warehouse.toString() : null;
    let lineDefaultSizeId = null;
    if (lineWarehouseId && !item.size) {
      const spDoc = await SubProduct.findById(item.subproduct).select('defaultSize').lean();
      lineDefaultSizeId = spDoc?.defaultSize || null;
    }
    await restoreStock({
      subProductId: item.subproduct?.toString() || item.subproduct,
      sizeId:       item.size ? item.size.toString() : null,
      quantity:     item.quantity,
      tenantId:     req.tenant?._id,
      staffId:      req.posUser._id,
      returnNumber: voidNumber,
      productId:    item.product || undefined,
      unitPrice:    item.priceAtPurchase || 0,
      warehouseId:    lineWarehouseId,
      defaultSizeId:  lineDefaultSizeId,
      batchAllocations: item.batchAllocations,
    });
  }

  order.isVoided  = true;
  order.voidedAt  = new Date();
  order.voidedBy  = req.posUser._id;
  order.voidReason = reason;
  order.paymentStatus = 'refunded';
  order.status    = 'cancelled';
  await order.save();

  // Void of a wallet-paid sale returns the still-outstanding amount to the wallet
  // (anything already refunded was settled by those refunds, so don't double-credit).
  if (order.paymentMethod === 'wallet') {
    const alreadyRefunded = (order.refunds || []).reduce((s, r) => s + (r.totalRefunded || 0), 0);
    await creditWalletRefund({
      order,
      tenantId: req.tenant?._id,
      amount: (order.totalAmount || 0) - alreadyRefunded,
      reference: voidNumber,
      reason: `Void — ${voidNumber}`,
      staffId: req.posUser._id,
    });
  }

  // Unwind any loyalty earned/redeemed on the voided sale (idempotent — a no-op if a
  // prior full refund already reversed it).
  await reverseLoyaltyForOrder({
    order,
    tenantId: req.tenant?._id,
    reference: voidNumber,
    reason: `Reversed — void ${voidNumber}`,
    staffId: req.posUser._id,
  });

  res.json({ success: true, data: { order: { _id: order._id, receiptNumber: order.receiptNumber, isVoided: true } } });
});

// ─── Hold Order ────────────────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/hold
 * Body: { items, customer, note, discountType, discountValue, pricelistId,
 *         shopId, terminalType, sessionId, appliedRewards, tableId, guests }
 *
 * Saves a cart snapshot as an Order with status 'hold'. No stock is deducted.
 * The held order can be recalled later to rehydrate the cart.
 */

/** Strict "24-hex-char string" check — looser validators accept numbers and
 *  ObjectIds, which would turn a client typo into a CastError 500 downstream. */
function isObjectIdString(v) {
  return typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
}

/**
 * The Order.items lines a hold persists. A hold is not a sale: these stay 0 so
 * a parked cart never books revenue — `getAllPOSOrders` has no status filter, so
 * a hold that carried a total would show up in POS history and the session
 * report as money taken.
 */
function buildHoldLineItems(items, tenantId) {
  return items.map((item) => ({
    product:               item.productId,
    subproduct:            item.subProductId,
    size:                  item.sizeId || undefined,
    quantity:              item.quantity,
    priceAtPurchase:       0,
    itemSubtotal:          0,
    discountAmount:        0,
    tenant:                tenantId,
  }));
}

/**
 * The cart lines themselves, kept whole.
 *
 * `Order.items` cannot carry a cart line: `orderItemSchema` is strict, so the
 * display fields this used to write as `_name`/`_variant`/`_sku` were dropped
 * before they reached Mongo and every recalled line came back called
 * "Product" — and its money had to be zeroed for the reason above, which left
 * the price and the cashier's negotiated discount with nowhere to live.
 *
 * `holdMetadata` is Mixed and exists for exactly this: cart state that is not
 * an order. Mapped field by field rather than storing `req.body.items` raw,
 * so a client cannot smuggle arbitrary keys into a persisted document.
 */
function buildHoldCartItems(items) {
  return items.map((item) => ({
    subProductId:  item.subProductId,
    productId:     item.productId,
    sizeId:        item.sizeId || undefined,
    name:          item.name || 'Product',
    variant:       item.variant || '',
    sku:           item.sku || '',
    image:         item.image,
    categoryId:    item.categoryId,
    brandId:       item.brandId,
    price:         Number(item.price)    || 0,
    quantity:      Number(item.quantity) || 0,
    discount:      Number(item.discount) || 0,
    stock:         Number(item.stock)    || 0,
    costPrice:     Number(item.costPrice) || 0,
    originalPrice: item.originalPrice,
    activeBundles: item.activeBundles,
    comboRef:      item.comboRef,
    bxgyRef:       item.bxgyRef,
  }));
}

/**
 * Document construction shared by every path that parks a hold: the manual
 * /orders/hold endpoint and openTabAtTable (a venue tab IS a hold, bound to a
 * POSTable). Keeping one builder means the snapshot rules — zeroed revenue
 * lines, mapped cart items, session resolution — cannot drift between them.
 */
async function createHoldOrder({
  tenantId,
  staffId,
  items,
  customer,
  note,
  discountType,
  discountValue,
  pricelistId,
  shopId, // eslint-disable-line no-unused-vars — accepted for call-site parity with the hold body
  terminalType,
  sessionId,
  appliedRewards,
  tableId,
  guests,
}) {
  const orderNumber = await generateOrderNumber();

  const holdItems = buildHoldLineItems(items, tenantId);
  const cartItems = buildHoldCartItems(items);

  // Session lookup — optional, for scoping holds to a session
  let session = null;
  if (sessionId) {
    session = await POSSession.findOne({ _id: sessionId, tenant: tenantId, status: 'open' });
  }
  if (!session) {
    session = await POSSession.findOne({ tenant: tenantId, status: 'open', terminalType })
      .sort({ openedAt: -1 });
  }

  return Order.create({
    orderNumber,
    tenant:        tenantId,
    source:        'pos',
    status:        'hold',
    items:         holdItems,
    subtotal:      0,
    totalAmount:   0,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    posSessionId:  session?._id || null,
    posStaff:      staffId,
    note,
    discountTotal: 0,
    shippingFee:   0,
    appliedPricelist: pricelistId ? {
      pricelistId,
      pricelistName: '',
    } : undefined,
    holdMetadata: {
      customer,
      discountType,
      discountValue,
      terminalType,
      appliedRewards,
      cartItems,
      // Table binding for venue tabs. listTables reads tableId/guests/openedAt
      // from here (see posTable.controller.listTables) — createdAt alone can't
      // distinguish "opened at 21:58" from "last edited at 22:40".
      tableId: tableId || null,
      guests:  guests || 0,
      openedAt: new Date().toISOString(),
    },
  });
}

exports.holdPOSOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const staffId  = req.posUser._id;

  const {
    items = [],
    customer = {},
    note = '',
    discountType,
    discountValue = 0,
    pricelistId,
    shopId,
    terminalType = 'retail',
    sessionId,
    appliedRewards = [],
    tableId,
    guests = 0,
  } = req.body;

  if (!items.length) {
    return res.status(400).json({ success: false, message: 'No items to hold' });
  }
  if (tableId !== undefined && !isObjectIdString(tableId)) {
    return res.status(400).json({ success: false, message: 'invalid tableId' });
  }

  const order = await createHoldOrder({
    tenantId,
    staffId,
    items,
    customer,
    note,
    discountType,
    discountValue,
    pricelistId,
    shopId,
    terminalType,
    sessionId,
    appliedRewards,
    tableId,
    guests,
  });

  res.status(201).json({
    success: true,
    data: {
      order: {
        _id:           order._id,
        orderNumber:   order.orderNumber,
        status:        order.status,
        itemCount:     (order.items || []).reduce((s, i) => s + i.quantity, 0),
        customer,
        note,
        createdAt:     order.createdAt,
      },
    },
  });
});

// ─── Open Tab at Table ────────────────────────────────────────────────────────
/**
 * POST /api/pos/tables/:id/open-tab  (body carries tableId)
 * Body: { tableId, guests?, terminalType? }
 *
 * Seats a party: parks an empty hold as the table's tab and claims the table in
 * the same breath. Items arrive later via updateTab as the party orders.
 *
 * The claim is deliberately conditional (`status: 'available'`) so two terminals
 * reaching for one free table resolve to a single winner at Mongo, not in JS:
 * the loser's just-created hold is recalled immediately, leaving no orphaned
 * bill pretending to sit at somebody else's table.
 */
exports.openTabAtTable = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenantId = req.tenant?._id;
  const { tableId, guests = 0, terminalType = 'retail' } = req.body;

  if (!tableId) {
    return res.status(400).json({ success: false, message: 'tableId is required' });
  }
  if (!isObjectIdString(tableId)) {
    return res.status(400).json({ success: false, message: 'invalid tableId' });
  }

  const table = await POSTable.findOne({ _id: tableId, tenant: tenantId });
  if (!table) {
    return res.status(404).json({ success: false, message: 'Table not found' });
  }
  if (table.status === 'occupied' && table.currentTabId) {
    return res.status(409).json({ success: false, message: 'table already has an open tab' });
  }

  const order = await createHoldOrder({
    tenantId,
    staffId:         req.posUser._id,
    items:           [],
    customer:        {},
    note:            '',
    discountType:    undefined,
    discountValue:   0,
    pricelistId:     undefined,
    terminalType,
    sessionId:       undefined,
    appliedRewards:  [],
    tableId,
    guests,
  });

  const claimed = await POSTable.findOneAndUpdate(
    { _id: tableId, tenant: tenantId, status: 'available' },
    { $set: { status: 'occupied', currentTabId: order._id } },
    { new: true }
  );

  if (!claimed) {
    // Someone else claimed the table between our check and our claim. Recall
    // the orphaned hold (same treatment as recallPOSOrder — findOneAndUpdate
    // skips enum validation, which is how 'recalled'/'cancelled' persist).
    await Order.findOneAndUpdate(
      { _id: order._id, ...tenantScope(tenantId) },
      { $set: { status: 'recalled', paymentStatus: 'cancelled' } }
    );
    return res.status(409).json({ success: false, message: 'table no longer available' });
  }

  res.status(201).json({ success: true, data: { table: claimed, tab: order } });
});

// ─── Update Tab ───────────────────────────────────────────────────────────────
/**
 * PUT /api/pos/tabs/:id
 * Body: any of { items, customer, note, discountType, discountValue, appliedRewards }
 *
 * Edits a parked tab in place — new rounds, a name on the bill, a comped
 * dessert. Identity (_id, createdAt, table binding) is never touched: the floor
 * map points at the tab's _id, so an edit that changed identity would orphan
 * every table pointing at the old one.
 */
exports.updateTab = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenantId = req.tenant?._id;

  const order = await Order.findOne({ _id: req.params.id, ...tenantScope(tenantId), status: 'hold' });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Held order not found' });
  }

  const { items, customer, note, discountType, discountValue, appliedRewards } = req.body;

  if (!order.holdMetadata || typeof order.holdMetadata !== 'object') {
    // Legacy holds parked before holdMetadata existed still deserve edits.
    order.holdMetadata = {};
  }
  if (Array.isArray(items)) {
    order.items = buildHoldLineItems(items, tenantId);
    order.holdMetadata.cartItems = buildHoldCartItems(items);
  }
  if (customer !== undefined)      order.holdMetadata.customer = customer;
  if (note !== undefined)          order.note = note;
  if (discountType !== undefined)  order.holdMetadata.discountType = discountType;
  if (discountValue !== undefined) order.holdMetadata.discountValue = discountValue;
  if (appliedRewards !== undefined) order.holdMetadata.appliedRewards = appliedRewards;

  await order.save();

  res.json({ success: true, data: { tab: order } });
});

// ─── Get Held Orders ───────────────────────────────────────────────────────────
/**
 * GET /api/pos/orders/held
 * Returns all hold orders for the current tenant.
 */
exports.getHeldPOSOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  // Match either scoping: the root `tenant` (written since it was declared on
  // the schema) or `items.tenant` (every hold parked before that). Scoping on
  // the root alone would make existing holds unreachable.
  const holds = await Order.find({ ...tenantScope(tenantId), status: 'hold' })
    .select('orderNumber items note createdAt holdMetadata')
    .sort({ createdAt: -1 })
    .lean();

  const result = holds.map((h) => {
    const meta = h.holdMetadata || {};
    const cust = meta.customer || {};
    return {
      _id:         h._id,
      orderNumber: h.orderNumber,
      itemCount:   h.items.reduce((s, i) => s + i.quantity, 0),
      customer:    `${cust.firstName || ''} ${cust.lastName || ''}`.trim() || 'Walk-in Customer',
      note:        h.note || '',
      createdAt:   h.createdAt,
      // The parked cart snapshot, read-only. Venue tab loading needs it and
      // must not go through recallPOSOrder, which consumes the hold.
      holdMetadata: meta,
    };
  });

  res.json({ success: true, data: { orders: result } });
});

// ─── Recall Held Order ─────────────────────────────────────────────────────────
/**
 * POST /api/pos/orders/:id/recall
 * Returns the full cart data from a held order and removes it.
 */
exports.recallPOSOrder = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const order = await Order.findOne({ _id: req.params.id, ...tenantScope(tenantId), status: 'hold' }).lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Held order not found' });
  }

  const meta = order.holdMetadata || {};

  // The cart snapshot is the source of truth — it is the only place the line's
  // price, discount and combo grouping survive (see holdPOSOrder). Holds parked
  // before that snapshot existed have no `cartItems`, and are rebuilt from
  // `Order.items` as far as it goes: refusing to open a parked sale is worse
  // than opening it with the prices missing.
  const cartItems = Array.isArray(meta.cartItems) && meta.cartItems.length
    ? meta.cartItems.map((item) => ({
        ...item,
        subProductId: String(item.subProductId),
        productId:    String(item.productId),
        sizeId:       item.sizeId ? String(item.sizeId) : undefined,
      }))
    : order.items.map((item) => ({
        subProductId: String(item.subproduct || item.product),
        productId:    String(item.product),
        sizeId:       item.size ? String(item.size) : undefined,
        name:         'Product',
        variant:      '',
        sku:          '',
        quantity:     item.quantity,
        price:        0,
        discount:     0,
      }));

  // Mark as recalled instead of deleting — preserves audit trail
  await Order.findOneAndUpdate(
    { _id: order._id },
    { $set: { status: 'recalled', paymentStatus: 'cancelled' } }
  );

  res.json({
    success: true,
    data: {
      cart: {
        items:     cartItems,
        customer:  meta.customer || { firstName: 'Walk-in', lastName: 'Customer', email: '', phone: '' },
        note:      order.note || '',
        discountType:  meta.discountType || 'percent',
        discountValue: meta.discountValue || 0,
        pricelistId:   order.appliedPricelist?.pricelistId || null,
      },
    },
  });
});

// ─── Kitchen display (Phase 6B) ──────────────────────────────────────────────
//
// A fired round is a frozen ticket: the cashier selects lines on a held tab,
// the server snapshots what the kitchen owes the pass into
// holdMetadata.firedRounds, and the kitchen screen bumps each round forward
// through pending → preparing → ready → served. The parked cart keeps living
// after a fire (lines renamed, quantities edited) — that is exactly why the
// snapshot exists, and why it is built by copying values rather than keeping
// references.

/**
 * Identity of one cart line, byte-compatible with the client's itemKey:
 * `subProductId[_sizeId]` plus a combo-instance or buy-x-get-y suffix. Every
 * later fire looks its lines up with this key, so any drift between the two
 * sides silently strands orders on the board — mirror pos-cart.tsx exactly.
 */
function buildPosItemKey(it) {
  const base = it.sizeId ? `${it.subProductId}_${it.sizeId}` : String(it.subProductId);
  if (it.comboRef?.instanceId) return `${base}__ci_${it.comboRef.instanceId}`;
  if (it.bxgyRef?.rewardId) return `${base}__bxgy_${it.bxgyRef.rewardId}_${it.bxgyRef.role}`;
  return base;
}

/**
 * What of the parked cart has not gone to the kitchen yet: per line key, the
 * quantity still owed after netting every fired round. Lines fully consumed
 * drop out; partial ones come back with their remainder.
 */
function computeUnfiredLines(cartItems, firedRounds) {
  const rounds = Array.isArray(firedRounds) ? firedRounds : [];
  return (Array.isArray(cartItems) ? cartItems : [])
    .map((item) => {
      const key = buildPosItemKey(item);
      let fired = 0;
      for (const round of rounds) {
        for (const ri of round.items || []) {
          if (ri.key === key) fired += Number(ri.quantity) || 0;
        }
      }
      const remaining = Math.max(0, (Number(item.quantity) || 0) - fired);
      return { item, key, remaining };
    })
    .filter((l) => l.remaining > 0);
}

/**
 * Forward-only pipeline: pending → preparing → ready → served. Served is
 * terminal and unknown statuses have nowhere to go — both answer null so a
 * stale client cannot walk a ticket backwards.
 */
const KITCHEN_FLOW = { pending: 'preparing', preparing: 'ready', ready: 'served' };
function nextRoundStatus(status) {
  return KITCHEN_FLOW[status] ?? null;
}
exports.buildPosItemKey = buildPosItemKey;
exports.computeUnfiredLines = computeUnfiredLines;
exports.nextRoundStatus = nextRoundStatus;

/**
 * POST /api/pos/tabs/:id/fire
 * Body: { itemKeys: string[] }   (client-format keys from buildPosItemKey)
 *
 * Fires the unfired remainder of the requested lines as one kitchen round.
 * Every requested key must still have something to fire — a cashier tapping an
 * already-fired course expects a complaint, not a silently empty ticket.
 */
exports.fireRoundFromCart = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenantId = req.tenant?._id;

  const order = await Order.findOne({ _id: req.params.id, ...tenantScope(tenantId), status: 'hold' });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Held order not found' });
  }

  const { itemKeys } = req.body;
  if (!Array.isArray(itemKeys) || !itemKeys.length || itemKeys.some((k) => typeof k !== 'string')) {
    return res.status(400).json({ success: false, message: 'itemKeys must be a non-empty array of strings' });
  }

  const meta = order.holdMetadata && typeof order.holdMetadata === 'object' ? order.holdMetadata : {};
  const remainingByKey = new Map(
    computeUnfiredLines(meta.cartItems || [], meta.firedRounds || []).map((l) => [l.key, l])
  );

  // Refuse up front if ANY requested key is exhausted or unknown — the fire is
  // all-or-nothing, so the ticket never half-matches what was tapped.
  const missing = [...new Set(itemKeys)].filter((k) => !remainingByKey.has(k));
  if (missing.length) {
    return res.status(400).json({ success: false, message: `nothing to fire for ${missing[0]}` });
  }

  // Frozen snapshot, in the order the cashier fired them. Values copied, not
  // referenced: cartItems keep changing after this point.
  const items = [...new Set(itemKeys)].map((k) => {
    const { item, remaining } = remainingByKey.get(k);
    return {
      key:           k,
      name:          item.name,
      variant:       item.variant,
      quantity:      remaining,
      subProductId:  item.subProductId,
    };
  });

  const rounds = Array.isArray(meta.firedRounds) ? meta.firedRounds : [];
  const lastRound = rounds[rounds.length - 1];
  const round = {
    roundNo:  (lastRound?.roundNo ?? 0) + 1,
    items,
    firedAt:  new Date(),
    firedBy:  req.posUser._id,
    status:   'pending',
    bumpedAt: null,
    bumpedBy: null,
  };

  meta.firedRounds = [...rounds, round];
  order.holdMetadata = meta;
  order.markModified('holdMetadata');   // Mixed type — deep edits are invisible to Mongoose otherwise
  await order.save();

  emitToKds(req, tenantId, 'kds:update', { orderId: order._id });

  res.json({ success: true, data: { round } });
});

/**
 * GET /api/pos/kitchen/active
 *
 * One board query for every held tab carrying at least one fired round, with
 * served rounds stripped out. Table names resolve in a single batched query —
 * the board refetches often enough that N+1 would be felt at every bump.
 */
exports.getKitchenActive = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenantId = req.tenant?._id;

  const rows = await Order.find({
    ...tenantScope(tenantId),
    status: 'hold',
    'holdMetadata.firedRounds.0': { $exists: true },
  })
    .select('holdMetadata createdAt')
    .lean();

  // Served rounds leave the ticket; tickets left with nothing active leave the board.
  const candidates = rows
    .map((o) => {
      const meta = o.holdMetadata || {};
      const rounds = (Array.isArray(meta.firedRounds) ? meta.firedRounds : [])
        .filter((r) => r && r.status !== 'served')
        .sort((a, b) => (a.roundNo ?? 0) - (b.roundNo ?? 0));
      return {
        orderId:  o._id,
        tableId:  meta.tableId ? String(meta.tableId) : null,
        guests:   meta.guests ?? 0,
        openedAt: meta.openedAt || o.createdAt,
        rounds,
      };
    })
    .filter((row) => row.rounds.length > 0);

  const tableIds = [...new Set(candidates.map((c) => c.tableId).filter(Boolean))];
  const tables = tableIds.length
    ? await POSTable.find({ tenant: tenantId, _id: { $in: tableIds } }).select('name').lean()
    : [];
  const nameByTable = new Map(tables.map((tb) => [String(tb._id), tb.name]));

  const oldestFired = (row) =>
    Math.min(...row.rounds.map((r) => new Date(r.firedAt || 0).getTime()));

  const orders = candidates
    .map(({ tableId, ...row }) => ({
      ...row,
      tableName: tableId ? nameByTable.get(tableId) ?? null : null,
    }))
    .sort((a, b) => oldestFired(a) - oldestFired(b));

  res.json({ success: true, data: { orders } });
});

/**
 * POST /api/pos/kitchen/rounds/bump
 * Body: { orderId, roundNo, nextStatus }
 *
 * Moves one kitchen round exactly one step along the pipeline. The next state
 * is computed server-side from the current one, so a stale screen (or a tired
 * cook) cannot drag a ticket backwards past food that already left.
 */
exports.bumpKitchenRound = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenantId = req.tenant?._id;
  const { orderId, roundNo, nextStatus } = req.body;

  if (!orderId || roundNo === undefined || roundNo === null || !nextStatus) {
    return res.status(400).json({ success: false, message: 'orderId, roundNo and nextStatus are required' });
  }

  const order = await Order.findOne({ _id: orderId, ...tenantScope(tenantId), status: 'hold' });
  if (!order) {
    return res.status(404).json({ success: false, message: 'Held order not found' });
  }

  const rounds = Array.isArray(order.holdMetadata?.firedRounds) ? order.holdMetadata.firedRounds : [];
  const round = rounds.find((r) => Number(r.roundNo) === Number(roundNo));
  if (!round) {
    return res.status(404).json({ success: false, message: 'Round not found' });
  }

  const expected = nextRoundStatus(round.status);
  if (!expected || nextStatus !== expected) {
    return res.status(400).json({
      success: false,
      message: `round is ${round.status}, next is ${expected}`,
    });
  }

  round.status   = nextStatus;
  round.bumpedAt = new Date();
  round.bumpedBy = req.posUser._id;
  order.markModified('holdMetadata');
  await order.save();

  emitToKds(req, tenantId, 'kds:update', { orderId: order._id, roundNo: round.roundNo });

  res.json({ success: true, data: { round } });
});

// ─── Get POS Session Orders ───────────────────────────────────────────────────
/**
 * GET /api/pos/sessions/:id/orders
 */
/**
 * GET /api/pos/session-info
 * POS-token protected — returns current session info for the cashier's tenant.
 * Also returns the last closed session for balance display.
 */
exports.getPOSSessionInfo = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const terminalType = ['retail', 'wholesale'].includes(req.query.terminalType)
    ? req.query.terminalType
    : 'retail';

  const [openSession, lastClosed] = await Promise.all([
    POSSession.findOne({ tenant: tenantId, status: 'open', terminalType })
      .populate('openedBy activeCashier', 'firstName lastName posName avatar')
      .lean(),
    POSSession.findOne({ tenant: tenantId, status: 'closed', terminalType })
      .sort({ closedAt: -1 })
      .select('closedAt totalSales orderCount closedBy')
      .populate('closedBy', 'firstName lastName posName')
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      currentSession: openSession || null,
      lastSession:    lastClosed  || null,
    },
  });
});

// ─── All POS Orders (across all sessions) ────────────────────────────────────
/**
 * GET /api/pos/orders
 * Returns all POS orders for this tenant, newest first.
 * Supports: ?limit=&page=&search=&status=
 */
exports.getAllPOSOrders = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(500, parseInt(req.query.limit) || 200);
  const skip  = (page - 1) * limit;

  const orders = await Order.find({ 'items.tenant': tenantId, source: 'pos' })
    .select('orderNumber receiptNumber totalAmount subtotal discountTotal paymentMethod paymentStatus status placedAt createdAt posStaff isVoided refunds items paymentDetails posSessionId')
    .populate('posStaff', 'firstName lastName posName')
    .populate({ path: 'posSessionId', select: 'terminalType openedAt status', strictPopulate: false })
    .populate({
      path: 'items.product',
      select: 'name brand category subCategory',
      populate: [
        { path: 'brand',       select: 'name' },
        { path: 'category',    select: 'name' },
        { path: 'subCategory', select: 'name' },
      ],
    })
    .populate('items.size', 'displayName costPrice')
    .populate('items.subproduct', 'costPrice')
    .populate('items.warehouse', 'name code')
    .populate({ path: 'refunds.refundedBy', select: 'firstName lastName posName', strictPopulate: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const mapped = orders.map((o) => ({
    ...o,
    total:        o.totalAmount,
    subtotal:     o.subtotal     || o.totalAmount,
    discountTotal: o.discountTotal || 0,
    customer:     o.paymentDetails?.customer || null,
    session:      o.posSessionId && typeof o.posSessionId === 'object'
      ? { _id: o.posSessionId._id, terminalType: o.posSessionId.terminalType, openedAt: o.posSessionId.openedAt }
      : o.posSessionId ? { _id: o.posSessionId } : null,
    paymentDetails: {
      splitPayments: o.paymentDetails?.splitPayments || [],
      change:        o.paymentDetails?.change        || 0,
      amount:        o.paymentDetails?.amount        || 0,
    },
    items: (o.items || []).map((it) => ({
      name:            it._name || it.product?.name || 'Product',
      variant:         it._variant || it.size?.displayName || '',
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemSubtotal:    it.itemSubtotal,
      discountAmount:  it.discountAmount || 0,
      sizeCostPrice:   it.size?.costPrice || it.subproduct?.costPrice || 0,
      category:        it.product?.category?.name    || '',
      subcategory:     it.product?.subCategory?.name || '',
      brand:           it.product?.brand?.name       || '',
      warehouse:       it.warehouse
        ? { _id: it.warehouse._id, name: it.warehouse.name, code: it.warehouse.code }
        : null,
    })),
  }));

  res.json({ success: true, data: mapped });
});

exports.getPOSSessionOrders = asyncHandler(async (req, res) => {
  // Verify the session belongs to this tenant before returning its orders
  const session = await POSSession.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const orders = await Order.find({ posSessionId: req.params.id, ...tenantScope(req.tenant?._id) })
    .select('orderNumber receiptNumber totalAmount subtotal discountTotal paymentMethod paymentStatus status placedAt createdAt posStaff isVoided refunds items paymentDetails')
    .populate('posStaff', 'firstName lastName posName')
    .populate({
      path: 'items.product',
      select: 'name brand category subCategory',
      populate: [
        { path: 'brand',       select: 'name' },
        { path: 'category',    select: 'name' },
        { path: 'subCategory', select: 'name' },
      ],
    })
    .populate('items.size', 'displayName costPrice')
    .populate('items.subproduct', 'costPrice')
    .populate('items.warehouse', 'name code')
    .populate({ path: 'refunds.refundedBy', select: 'firstName lastName posName', strictPopulate: false })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const mapped = orders.map((o) => ({
    ...o,
    total:         o.totalAmount,
    subtotal:      o.subtotal     || o.totalAmount,
    discountTotal: o.discountTotal || 0,
    customer:      o.paymentDetails?.customer || null,
    paymentDetails: {
      splitPayments: o.paymentDetails?.splitPayments || [],
      change:        o.paymentDetails?.change        || 0,
      amount:        o.paymentDetails?.amount        || 0,
    },
    items: (o.items || []).map((it) => ({
      name:            it._name || it.product?.name || 'Product',
      variant:         it._variant || it.size?.displayName || '',
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemSubtotal:    it.itemSubtotal,
      discountAmount:  it.discountAmount || 0,
      sizeCostPrice:   it.size?.costPrice || it.subproduct?.costPrice || 0,
      category:        it.product?.category?.name    || '',
      subcategory:     it.product?.subCategory?.name || '',
      brand:           it.product?.brand?.name       || '',
      warehouse:       it.warehouse
        ? { _id: it.warehouse._id, name: it.warehouse.name, code: it.warehouse.code }
        : null,
    })),
  }));

  res.json({ success: true, data: mapped });
});

// ─── POS Customer endpoints ───────────────────────────────────────────────────

// Flatten a (lean) POSCustomer whose `pricelist` ref was populated with `name`
// into the wire shape the POS client expects: `pricelist` stays an id string (or
// null) and a sibling `pricelistName` carries the label for the selector badge.
function flattenCustomerPricelist(doc) {
  if (!doc) return doc;
  const pl = doc.pricelist;
  if (pl && typeof pl === 'object' && pl._id) {
    return { ...doc, pricelist: String(pl._id), pricelistName: pl.name || '' };
  }
  return { ...doc, pricelist: pl ? String(pl) : null, pricelistName: '' };
}

exports.searchPOSCustomers = asyncHandler(async (req, res) => {
  const POSCustomer = require('../models/POSCustomer');
  const tenantId = req.tenant?._id;
  const { q = '', limit = 20 } = req.query;
  const lim = Math.min(50, parseInt(limit) || 20);

  let filter = { tenant: tenantId };
  if (q.trim()) {
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter = {
      tenant: tenantId,
      $or: [
        { phone: { $regex: rx } },
        { firstName: { $regex: rx } },
        { lastName: { $regex: rx } },
        { email: { $regex: rx } },
      ],
    };
  }

  const customers = await POSCustomer.find(filter)
    .sort({ updatedAt: -1 })
    .limit(lim)
    .select('firstName lastName email phone loyaltyPoints walletBalance totalSpent totalOrders pricelist')
    .populate('pricelist', 'name')
    .lean();

  res.json({ success: true, data: { customers: customers.map(flattenCustomerPricelist) } });
});

exports.createPOSCustomer = asyncHandler(async (req, res) => {
  const POSCustomer = require('../models/POSCustomer');
  const tenantId = req.tenant?._id;
  const { firstName, lastName = '', email = '', phone = '', notes = '' } = req.body;

  if (!firstName?.trim())
    return res.status(400).json({ success: false, message: 'First name is required' });

  if (phone.trim()) {
    const existing = await POSCustomer.findOne({ tenant: tenantId, phone: phone.trim() }).lean();
    if (existing)
      return res.status(409).json({
        success: false,
        message: 'A customer with this phone number already exists',
        data: { customer: existing },
      });
  }

  const customer = await POSCustomer.create({
    tenant: tenantId,
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    email:     email.trim(),
    phone:     phone.trim(),
    notes:     notes.trim(),
  });

  res.status(201).json({ success: true, data: { customer } });
});

exports.getPOSCustomer = asyncHandler(async (req, res) => {
  const POSCustomer = require('../models/POSCustomer');
  const tenantId = req.tenant?._id;
  const customer = await POSCustomer.findOne({ _id: req.params.id, tenant: tenantId })
    .select('firstName lastName email phone loyaltyPoints walletBalance totalSpent totalOrders notes pricelist')
    .populate('pricelist', 'name')
    .lean();
  if (!customer)
    return res.status(404).json({ success: false, message: 'Customer not found' });
  res.json({ success: true, data: { customer: flattenCustomerPricelist(customer) } });
});

// Resolve a best-effort default billing/delivery address for a POSCustomer, used
// by the Sales create page to prefill its invoice/delivery blocks. POSCustomer
// itself stores no address, so we resolve in priority order:
//   1. The customer's linked ecommerce User (matched by normalized email/phone
//      within the same tenant) → its default billing Address, then default
//      shipping, then most-recent active Address.
//   2. The customer's most recent non-cancelled Order (matched by the order's
//      `paymentDetails.customer.customerId`, falling back to a normalized
//      phone/email match on the order's shippingAddress) → that order's
//      shippingAddress snapshot.
// Returns { address: { name, phone, street, city, state, country } | null }.
// All fields are optional; the client treats null as "no default available".
exports.getPOSCustomerDefaultAddress = asyncHandler(async (req, res) => {
  const Address = require('../models/Address');
  const {
    normalizeEmail,
    normalizePhone,
  } = require('../services/contact.helpers');
  const tenantId = req.tenant?._id;
  const cust = await POSCustomer.findOne({ _id: req.params.id, tenant: tenantId })
    .select('firstName lastName email phone')
    .lean();
  if (!cust)
    return res.status(404).json({ success: false, message: 'Customer not found' });

  const normEmail = normalizeEmail(cust.email || '');
  const normPhone = normalizePhone(cust.phone || '');

  // 1) Linked ecommerce User → saved Address.
  if (normEmail || normPhone) {
    const or = [];
    if (normEmail) or.push({ email: normEmail });
    if (normPhone) or.push({ phone: { $regex: new RegExp('^' + normPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') } });
    const user = await User.findOne({ tenant: tenantId, role: 'customer', $or: or })
      .select('_id')
      .lean();
    if (user) {
      const addrQuery = { user: user._id, status: 'active' };
      let addr = await Address.findOne({ ...addrQuery, isDefaultBilling: true }).lean();
      if (!addr) addr = await Address.findOne({ ...addrQuery, isDefaultShipping: true }).lean();
      if (!addr) addr = await Address.findOne(addrQuery).sort({ updatedAt: -1 }).lean();
      if (addr) {
        const street = [addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ') || undefined;
        return res.json({
          success: true,
          data: {
            address: {
              name: addr.fullName || undefined,
              phone: addr.phone || undefined,
              street,
              city: addr.city || undefined,
              state: addr.state || undefined,
              country: addr.country || undefined,
            },
          },
        });
      }
    }
  }

  // 2) Most recent non-cancelled Order with this customer attached.
  const COMPLETED = ['confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered'];
  const or = [{ 'paymentDetails.customer.customerId': cust._id }];
  if (normPhone) or.push({ 'shippingAddress.phone': { $regex: new RegExp(normPhone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') } });
  if (normEmail) or.push({ 'shippingAddress.email': normEmail });
  const order = await Order.findOne({ 'items.tenant': tenantId, status: { $in: COMPLETED }, $or: or })
    .select('shippingAddress')
    .sort({ placedAt: -1, createdAt: -1 })
    .lean();
  if (order && order.shippingAddress) {
    const sa = order.shippingAddress;
    const street = [sa.addressLine1, sa.addressLine2].filter(Boolean).join(', ') || undefined;
    return res.json({
      success: true,
      data: {
        address: {
          name: sa.fullName || undefined,
          phone: sa.phone || undefined,
          street,
          city: sa.city || undefined,
          state: sa.state || undefined,
          country: sa.country || undefined,
        },
      },
    });
  }

  res.json({ success: true, data: { address: null } });
});

exports.updatePOSCustomerLoyalty = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { earned = 0, redeemed = 0, orderTotal = 0, orderId } = req.body;

  const customer = await POSCustomer.findOne({ _id: req.params.id, tenant: tenantId });
  if (!customer)
    return res.status(404).json({ success: false, message: 'Customer not found' });

  // Route the points move through mutateLoyalty so an append-only LoyaltyTransaction
  // is written per direction (loyaltyPoints stays the single source of truth). A
  // valid orderId links the rows back to the sale so refund/void can reverse them.
  const owner = {
    Model: POSCustomer,
    ownerType: 'POSCustomer',
    ownerId: customer._id,
    filter: { _id: customer._id, tenant: tenantId },
  };
  const staffId = req.posUser?._id;
  const relatedOrder =
    orderId && mongoose.Types.ObjectId.isValid(orderId) ? orderId : undefined;
  const earn = Math.max(0, Math.floor(Number(earned) || 0));
  const redeem = Math.max(0, Math.floor(Number(redeemed) || 0));

  // Redeem (debit) first, then earn — best-effort so a post-sale points hiccup never
  // fails the already-committed sale. The atomic guard blocks an overdraw.
  if (redeem > 0) {
    await mutateLoyalty({
      owner,
      tenantId,
      value: { type: 'redeem', points: redeem, reason: 'POS reward redemption' },
      relatedOrder,
      createdBy: staffId,
    }).catch((err) => console.error('[Loyalty] POS redeem failed:', err.message));
  }
  if (earn > 0) {
    await mutateLoyalty({
      owner,
      tenantId,
      value: { type: 'earn', points: earn, reason: 'POS sale earn' },
      relatedOrder,
      createdBy: staffId,
    }).catch((err) => console.error('[Loyalty] POS earn failed:', err.message));
  }

  // Lifetime spend/order counters live alongside loyaltyPoints; bump them with a
  // targeted $inc so we never clobber the atomic loyaltyPoints move above.
  if (orderTotal > 0) {
    await POSCustomer.updateOne(
      { _id: customer._id, tenant: tenantId },
      { $inc: { totalSpent: orderTotal, totalOrders: 1 } }
    );
  }

  const fresh = await POSCustomer.findOne({ _id: customer._id, tenant: tenantId }).select(
    'firstName lastName email phone loyaltyPoints walletBalance totalSpent totalOrders notes'
  );
  res.json({ success: true, data: { customer: fresh } });
});

// ─── POS Notifications — online platform orders for this tenant ───────────────

exports.getPOSNotifications = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id || req.user?.tenant;
  const since = req.query.since
    ? new Date(req.query.since)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const orders = await Order.find({
    'items.tenant': tenantId,
    source: { $ne: 'pos' },
    placedAt: { $gt: since },
    paymentStatus: 'paid',
  })
    .sort({ placedAt: -1 })
    .limit(50)
    .populate('user', 'firstName lastName email phone')
    .select('orderNumber placedAt total source status items user')
    .lean();

  const notifications = orders.map((o) => ({
    _id:         String(o._id),
    orderNumber: o.orderNumber,
    placedAt:    o.placedAt,
    total:       o.total,
    source:      o.source,
    status:      o.status,
    customer: o.user
      ? `${o.user.firstName || ''} ${o.user.lastName || ''}`.trim() || o.user.email || 'Customer'
      : 'Customer',
    itemCount: (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0),
    items: (o.items || []).slice(0, 5).map((i) => ({
      name:     i.name || i.productName || 'Item',
      qty:      i.quantity || 1,
      subtotal: i.itemSubtotal ?? 0,
    })),
  }));

  res.json({ success: true, data: { notifications } });
});

// ─── Sales Orders for POS ──────────────────────────────────────────────────────
// Returns SalesOrder docs (quotations and orders) for the POS terminal.
// POS tokens cannot reach the /api/sales-orders admin route (which requires
// protect + tenantUserOnly), so this endpoint lives under protectPOS.

const POS_SALES_ORDER_FIELDS = [
  '_id', 'soNumber', 'docType', 'quoteStatus', 'orderStatus',
  'customerSnapshot', 'total', 'createdAt', 'items',
  'warehouseId', 'salesperson', 'paymentMethod', 'paymentStatus',
];

exports.getSalesOrdersForPOS = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId) {
    return res.status(401).json({ success: false, message: 'Tenant not resolved' });
  }

  const {
    docType, status, search,
    limit = '50', page = '1',
    dateFrom, dateTo,
  } = req.query;

  const q = { tenant: tenantId };

  // Doc-type filter — omit to get both quotations and orders
  if (docType && ['quotation', 'order'].includes(docType)) {
    q.docType = docType;
  }

  // Status filter — scoped to docType by caller
  if (status) {
    if (q.docType === 'quotation') {
      q.quoteStatus = status;
    } else if (q.docType === 'order') {
      q.orderStatus = status;
    } else {
      // Mixed: search both status fields
      q.$or = [
        { quoteStatus: status },
        { orderStatus: status },
      ];
    }
  }

  // Text search
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = { $regex: escapedSearch, $options: 'i' };
    const textFilter = [
      { soNumber: searchRegex },
      { 'customerSnapshot.name': searchRegex },
    ];
    if (q.$or) {
      // Merge with status $or
      q.$and = [{ $or: q.$or }, { $or: textFilter }];
      delete q.$or;
    } else {
      q.$or = textFilter;
    }
  }

  // Date range
  if (dateFrom || dateTo) {
    q.createdAt = {};
    if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
    if (dateTo) q.createdAt.$lte = new Date(dateTo);
  }

  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * pageSize;

  const [data, total] = await Promise.all([
    SalesOrder.find(q)
      .select(POS_SALES_ORDER_FIELDS.join(' '))
      .populate('warehouseId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SalesOrder.countDocuments(q),
  ]);

  res.json({
    success: true,
    data: {
      salesOrders: data,
      pagination: {
        page: Math.max(parseInt(page, 10) || 1, 1),
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    },
  });
});

// ─── Reconcile a linked Sales Order after a POS sale ───────────────────────────
// The POS sale (createPOSOrder) already deducted stock and wrote the Sales rows,
// so this only reconciles the linked SalesOrder's status — advancing fulfilledQty
// for what was sold and marking it paid — with NO second stock deduction and NO
// duplicate Sales rows. A loaded quotation is converted to an order first. Lives
// under protectPOS because the /api/sales-orders/:id/fulfill admin route rejects
// POS tokens.

exports.reconcileSalesOrderFromPOS = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!tenantId) {
    return res.status(401).json({ success: false, message: 'Tenant not resolved' });
  }

  const salesFulfillSvc = require('../services/salesFulfill.service');
  const salesOrderSvc   = require('../services/salesOrder.service');
  const salesLog        = require('../services/salesActivity.service');

  let so = await SalesOrder.findOne({ _id: req.params.id, tenant: tenantId });
  if (!so) return res.status(404).json({ success: false, message: 'Sales order not found' });

  // Quotation → order (skip only terminally-dead quotations)
  if (so.docType === 'quotation') {
    if (['rejected', 'expired'].includes(so.quoteStatus)) {
      return res.status(409).json({ success: false, message: 'Quotation cannot be fulfilled' });
    }
    if (so.quoteStatus !== 'converted') {
      so = await salesOrderSvc.convertQuotationToOrder(so);
    } else if (so.convertedTo) {
      // Already converted — reconcile the resulting order instead.
      const linked = await SalesOrder.findOne({ _id: so.convertedTo, tenant: tenantId });
      if (linked) so = linked;
    }
  }

  if (so.orderStatus === 'cancelled') {
    return res.status(409).json({ success: false, message: 'A cancelled order cannot be fulfilled' });
  }
  if (so.orderStatus === 'fulfilled') {
    return res.status(409).json({ success: false, message: 'Order already fulfilled' });
  }

  const { paymentMethod, items: soldItems, ref, warehouseId } = req.body;

  // Map POS sold items → SO line ids (match on subproduct + size, clamp to
  // outstanding). Each SO line is consumed at most once.
  const consumed = new Set();
  const fulfillLines = [];
  for (const sold of soldItems || []) {
    const qtyWanted = Math.max(0, Number(sold.quantity) || 0);
    if (qtyWanted <= 0) continue;
    const line = so.items.find((it) => {
      if (consumed.has(String(it._id))) return false;
      if (it.lineType === 'section' || it.lineType === 'note') return false;
      if (String(it.subproduct || '') !== String(sold.subProductId || '')) return false;
      if (sold.sizeId && String(it.size || '') !== String(sold.sizeId)) return false;
      return true;
    });
    if (!line) continue;
    consumed.add(String(line._id));
    const outstanding = (line.quantity || 0) - (line.fulfilledQty || 0);
    const qty = Math.min(qtyWanted, outstanding);
    if (qty > 0) fulfillLines.push({ lineId: String(line._id), qty });
  }

  // reconcileFulfillment owns the money now: it settles amountPaid/paymentStatus
  // from the order's own lines, prorated by what was actually sold. This used to
  // read `paymentStatus = 'paid'; amountPaid = order.total` right here, which
  // called an order 3/10 sold paid in full and erased the rest of the receivable.
  const { order, reconciled, duplicate } = await salesFulfillSvc.reconcileFulfillment({
    salesOrder: so, fulfillLines, userId: req.posUser?._id || req.user?._id, ref,
    // The terminal's warehouse is the one the sale deducted stock from. Falling
    // back to the order's own warehouse keeps a fulfilment attributable even
    // when an older till build sends nothing.
    warehouseId: warehouseId || so.warehouseId || undefined,
    paymentMethod,
  });

  if (duplicate) {
    return res.json({ success: true, data: order, reconciled: 0, duplicate: true });
  }

  if (order.orderStatus === 'draft') order.orderStatus = 'confirmed';
  if (paymentMethod) order.paymentMethod = paymentMethod;
  await order.save();

  res.json({ success: true, data: order, reconciled });

  await salesLog.logActivity(tenantId, order._id, {
    subject: 'Sales Order fulfilled via POS',
    userId: req.posUser?._id || req.user?._id,
  });
});
