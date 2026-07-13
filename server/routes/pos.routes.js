const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  tenantUserOnly,
} = require('../middleware/auth.middleware');
const { protectPOS, requirePOSPermission, protectPOSOrAdmin } = require('../middleware/pos.middleware');

const {
  getSessionReport,
  getDailyReport,
  getReportSummary,
} = require('../controllers/pos.report.controller');

const {
  // Session
  openSession,
  closeSession,
  getClosingControl,
  getCurrentSession,
  getSessionList,
  getPOSDashboard,
  switchCashier,
  getPOSSessionOrders,
  getPOSSessionInfo,
  recordCashMove,
  getCashMoves,
  // Auth
  pinLogin,
  staffLogin,
  listPOSStaff,
  // Products
  getPOSProducts,
  getPOSProductMeta,
  // Orders
  createPOSOrder,
  holdPOSOrder,
  getHeldPOSOrders,
  recallPOSOrder,
  refundPOSOrder,
  voidPOSOrder,
  getAllPOSOrders,
  // Cashier management
  listCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  // Tenant settings
  updateTenantBankAccounts,
  getTenantBankAccounts,
  getPOSSettings,
  updatePOSSettings,
  // Shops
  listPOSShops,
  createPOSShop,
  updatePOSShop,
  deletePOSShop,
  // Notifications
  getPOSNotifications,
  // Customers
  searchPOSCustomers,
  createPOSCustomer,
  getPOSCustomer,
  updatePOSCustomerLoyalty,
  getPOSCustomerDefaultAddress,
  getSalesOrdersForPOS,
  reconcileSalesOrderFromPOS,
} = require('../controllers/pos.controller');

// ── Reject POS tokens on admin routes ────────────────────────────────────────
// Applied before the admin middleware chain so POS staff can't reach admin
// endpoints even though protect() would otherwise accept any valid JWT.
function rejectPOSTokens(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.type === 'pos') {
      return res.status(403).json({
        success: false,
        message: 'POS tokens are not permitted on admin endpoints',
      });
    }
  } catch {
    // Invalid token — let protect() handle the error
  }
  next();
}

// ── Public ───────────────────────────────────────────────────────────────────
router.post('/auth/pin-login',   pinLogin);      // legacy
router.post('/auth/staff-login', staffLogin);    // new: returns 12h POS token
router.get('/staff',             listPOSStaff);  // staff grid (public, no secrets)

// ── POS-token protected ───────────────────────────────────────────────────────
// All routes that the POS terminal calls with a POS-token.
// protectPOS verifies the token, cross-checks user.tenant === decoded.tenantId,
// and attaches req.tenant from the DB — never from the raw token claim.

router.get('/session-info',                   protectPOSOrAdmin, getPOSSessionInfo);
router.get('/notifications',                  protectPOSOrAdmin, getPOSNotifications);
router.get('/products',                       protectPOSOrAdmin, getPOSProducts);
router.get('/product-meta',                   protectPOSOrAdmin, getPOSProductMeta);
router.get('/orders',                         protectPOSOrAdmin, getAllPOSOrders);
router.post('/orders',                        protectPOS, requirePOSPermission('pos:sell'),   createPOSOrder);
router.post('/orders/hold',                   protectPOS, requirePOSPermission('pos:sell'),   holdPOSOrder);
router.get('/orders/held',                    protectPOS, getHeldPOSOrders);
router.post('/orders/:id/recall',             protectPOS, requirePOSPermission('pos:sell'),   recallPOSOrder);
router.post('/orders/:id/refund',             protectPOS, requirePOSPermission('pos:refund'), refundPOSOrder);
router.post('/orders/:id/void',               protectPOS, requirePOSPermission('pos:void'),   voidPOSOrder);

// Session management — called from POS terminal, uses POS token
// ── Selectable pricelists (cashier pricelist selector + back-office callers,
//    e.g. the Sales module's customer-pricelist auto-apply on /sales/create) ─
router.get('/pricelists', protectPOSOrAdmin, async (req, res, next) => {
  try {
    const tenantId = req.tenant?._id;
    const { shopId, customerId, warehouseId: warehouseOverride } = req.query;

    // A selected customer may have an assigned pricelist; it takes top precedence
    // so the auto-resolved id reflects the customer's pricelist on the selector.
    // This applies whether or not a shop is in play — resolveShopPricelist's
    // precedence chain (customer → shop → warehouse → default) degrades
    // gracefully to "customer → tenant default warehouse → default" when
    // shopId is absent (e.g. the Sales module, which has no shop concept).
    let customerPricelistId = null;
    let customerTags = null;
    if (customerId) {
      const POSCustomer = require('../models/POSCustomer');
      const cust = await POSCustomer.findOne({ _id: customerId, tenant: tenantId })
        .select('pricelist tags').lean();
      customerPricelistId = cust?.pricelist ? String(cust.pricelist) : null;
      customerTags = Array.isArray(cust?.tags) ? cust.tags.map(String) : [];
    }

    const { resolveShopPricelist } = require('../services/pricelist.service');
    const { resolved, allowed } = await resolveShopPricelist(
      req.tenant, tenantId, shopId, customerPricelistId,
      warehouseOverride || null, customerTags
    );
    res.json({
      success: true,
      data: {
        pricelists: allowed,
        resolvedId: resolved ? String(resolved._id) : null,
      },
    });
  } catch (err) { next(err); }
});

// ── Active combos for POS cashier ────────────────────────────────────────────
router.get('/combos', protectPOS, async (req, res, next) => {
  try {
    const POSCombo  = require('../models/POSCombo');
    const SubProduct = require('../models/SubProduct');
    const { calcPlatformCostPrice, calcPlatformSellingPrice, resolveRevenueRates, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
    const tenant = req.tenant;

    function computePrice(sp, sizeDoc) {
      const revenueModel      = tenant?.revenueModel        ?? 'markup';
      // Multi-pack sizes use the tenant's reduced pack rates
      const { markupPct, commissionPct } = resolveRevenueRates(tenant, sizeDoc?.unitsPerPack ?? 1);
      const platformMarkupPct = sp.product?.platformMarkup  ?? DEFAULT_PLATFORM_MARKUP;
      const rawCost    = (sizeDoc?.costPrice    > 0 ? sizeDoc.costPrice    : null) ?? sp.costPrice    ?? 0;
      const rawSelling = (sizeDoc?.sellingPrice > 0 ? sizeDoc.sellingPrice : null) ?? sp.baseSellingPrice ?? 0;
      if (rawCost <= 0 && rawSelling <= 0) return rawSelling;
      const platformCost = calcPlatformCostPrice(rawCost, rawSelling, revenueModel, markupPct, commissionPct);
      return calcPlatformSellingPrice(platformCost, platformMarkupPct) || rawSelling;
    }

    const combos = await POSCombo.find({ tenant: tenant._id, active: true })
      .populate({
        path:    'choiceLines.items.subProduct',
        select:  'sku baseSellingPrice costPrice sizes sellWithoutSizeVariants availableStock product',
        populate: [
          { path: 'product', select: 'name images type' },
          { path: 'sizes',   select: 'displayName sellingPrice costPrice unitsPerPack availableStock _id sku' },
        ],
      })
      .lean();

    // Enrich sizes with computed pricing + stock distribution
    const enriched = combos.map(combo => ({
      ...combo,
      choiceLines: (combo.choiceLines || []).map(line => ({
        ...line,
        items: (line.items || []).map(item => {
          const sp = item.subProduct;
          if (!sp) return item;
          let sizes = (sp.sizes || []).map(s => ({
            ...s,
            sellingPrice: computePrice(sp, s) || s.sellingPrice || 0,
          }));
          // Distribute stock if all sizes are 0
          if (sizes.length > 0 && !sp.sellWithoutSizeVariants && (sp.availableStock || 0) > 0
              && sizes.every(s => (s.availableStock || 0) <= 0)) {
            const per = Math.floor(sp.availableStock / sizes.length);
            const rem = sp.availableStock % sizes.length;
            sizes = sizes.map((s, i) => ({ ...s, availableStock: per + (i === 0 ? rem : 0) }));
          }
          return {
            ...item,
            subProduct: {
              ...sp,
              baseSellingPrice: computePrice(sp, null) || sp.baseSellingPrice || 0,
              sizes,
            },
          };
        }),
      })),
    }));

    res.json({ success: true, data: { combos: enriched } });
  } catch (err) { next(err); }
});

// ── Sales Orders (quotations & orders for POS) ──────────────────────────────
// POS terminals need to load existing quotations/orders into the cart. This
// endpoint is reachable by both POS tokens and admin JWTs so the back-office
// sales module can also use it if needed.
router.get('/sales-orders', protectPOSOrAdmin, getSalesOrdersForPOS);
router.post('/sales-orders/:id/reconcile', protectPOS, requirePOSPermission('pos:sell'), reconcileSalesOrderFromPOS);

// ── POS Customers (loyalty) ───────────────────────────────────────────────────
// GET (search) is also called by the Sales module's customer picker outside a
// POS session, so it accepts an admin JWT too — mutating routes stay POS-only.
router.get('/customers',                      protectPOSOrAdmin, searchPOSCustomers);
router.post('/customers',                     protectPOS, createPOSCustomer);
router.get('/customers/:id/default-address', protectPOSOrAdmin, getPOSCustomerDefaultAddress);
router.get('/customers/:id',                  protectPOS, getPOSCustomer);
router.patch('/customers/:id/loyalty',        protectPOS, updatePOSCustomerLoyalty);

router.get('/sessions/current',               protectPOS, getCurrentSession);
router.post('/sessions/open',                 protectPOS, openSession);
router.get('/sessions/:id/closing-control',   protectPOS, getClosingControl);
router.post('/sessions/:id/close',            protectPOS, closeSession);
router.post('/sessions/:id/switch-cashier',   protectPOS, switchCashier);
router.get('/sessions/:id/orders',            protectPOSOrAdmin, getPOSSessionOrders);
router.get('/sessions/:id/cash-moves',        protectPOS, getCashMoves);
router.post('/sessions/:id/cash-move',        protectPOS, recordCashMove);
router.get('/sessions',                       protectPOSOrAdmin, getSessionList);
router.get('/dashboard',                      protectPOSOrAdmin, getPOSDashboard);
router.get('/reports/summary',                protectPOSOrAdmin, getReportSummary);
router.get('/reports/daily',                  protectPOSOrAdmin, getDailyReport);
router.get('/reports/session/:id',            protectPOSOrAdmin, getSessionReport);

// ── Admin-JWT protected ───────────────────────────────────────────────────────
// rejectPOSTokens ensures POS tokens can't slip through the protect() check.
router.use(rejectPOSTokens, protect, attachTenant, tenantUserOnly);

router.get('/sessions',  getSessionList);

// ── Tenant admins only ────────────────────────────────────────────────────────
router.get('/cashiers',              tenantAdminOrSuperAdmin, listCashiers);
router.post('/cashiers',             tenantAdminOrSuperAdmin, createCashier);
router.patch('/cashiers/:id',        tenantAdminOrSuperAdmin, updateCashier);
router.delete('/cashiers/:id',       tenantAdminOrSuperAdmin, deleteCashier);
router.get('/tenant/bank-accounts',  tenantAdminOrSuperAdmin, getTenantBankAccounts);
router.patch('/tenant/bank-accounts',tenantAdminOrSuperAdmin, updateTenantBankAccounts);
router.get('/tenant/settings',       tenantAdminOrSuperAdmin, getPOSSettings);
router.patch('/tenant/settings',     tenantAdminOrSuperAdmin, updatePOSSettings);
router.get('/shops',                 tenantAdminOrSuperAdmin, listPOSShops);
router.post('/shops',                tenantAdminOrSuperAdmin, createPOSShop);
router.patch('/shops/:shopId',       tenantAdminOrSuperAdmin, updatePOSShop);
router.delete('/shops/:shopId',      tenantAdminOrSuperAdmin, deletePOSShop);

module.exports = router;
