const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  tenantUserOnly,
} = require('../middleware/auth.middleware');
const { protectPOS, requirePOSPermission } = require('../middleware/pos.middleware');

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
  // Orders
  createPOSOrder,
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

router.get('/session-info',                   protectPOS, getPOSSessionInfo);
router.get('/products',                       protectPOS, getPOSProducts);
router.get('/orders',                         protectPOS, getAllPOSOrders);
router.post('/orders',                        protectPOS, requirePOSPermission('pos:sell'),   createPOSOrder);
router.post('/orders/:id/refund',             protectPOS, requirePOSPermission('pos:refund'), refundPOSOrder);
router.post('/orders/:id/void',               protectPOS, requirePOSPermission('pos:void'),   voidPOSOrder);

// Session management — called from POS terminal, uses POS token
// ── Selectable pricelists (for cashier pricelist selector on sell page) ───────
router.get('/pricelists', protectPOS, async (req, res, next) => {
  try {
    const Pricelist = require('../models/Pricelist');
    const tenantId = req.tenant?._id;
    const filter = { isSelectable: true };
    if (tenantId) filter.tenant = tenantId;
    const pricelists = await Pricelist.find(filter)
      .select('name currency rules countryGroups website')
      .lean();
    res.json({ success: true, data: { pricelists } });
  } catch (err) { next(err); }
});

// ── Active combos for POS cashier ────────────────────────────────────────────
router.get('/combos', protectPOS, async (req, res, next) => {
  try {
    const POSCombo  = require('../models/POSCombo');
    const SubProduct = require('../models/SubProduct');
    const { calcPlatformCostPrice, calcPlatformSellingPrice, DEFAULT_PLATFORM_MARKUP } = require('../utils/pricing');
    const tenant = req.tenant;

    function computePrice(sp, sizeDoc) {
      const revenueModel      = tenant?.revenueModel        ?? 'markup';
      const markupPct         = tenant?.markupPercentage    ?? 25;
      const commissionPct     = tenant?.commissionPercentage ?? 12;
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
          { path: 'sizes',   select: 'displayName sellingPrice costPrice availableStock _id sku' },
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

router.get('/sessions/current',               protectPOS, getCurrentSession);
router.post('/sessions/open',                 protectPOS, openSession);
router.get('/sessions/:id/closing-control',   protectPOS, getClosingControl);
router.post('/sessions/:id/close',            protectPOS, closeSession);
router.post('/sessions/:id/switch-cashier',   protectPOS, switchCashier);
router.get('/sessions/:id/orders',            protectPOS, getPOSSessionOrders);
router.get('/sessions/:id/cash-moves',        protectPOS, getCashMoves);
router.post('/sessions/:id/cash-move',        protectPOS, recordCashMove);
router.get('/sessions',                       protectPOS, getSessionList);  // POS-token version (mirrors admin route)
router.get('/dashboard',                      protectPOS, getPOSDashboard);

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

module.exports = router;
