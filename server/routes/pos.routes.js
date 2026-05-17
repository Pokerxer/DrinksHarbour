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
  // Cashier management
  listCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
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
router.post('/orders',                        protectPOS, requirePOSPermission('pos:sell'),   createPOSOrder);
router.post('/orders/:id/refund',             protectPOS, requirePOSPermission('pos:refund'), refundPOSOrder);
router.post('/orders/:id/void',               protectPOS, requirePOSPermission('pos:void'),   voidPOSOrder);

// Session management — called from POS terminal, uses POS token
router.get('/sessions/current',               protectPOS, getCurrentSession);
router.post('/sessions/open',                 protectPOS, openSession);
router.get('/sessions/:id/closing-control',   protectPOS, getClosingControl);
router.post('/sessions/:id/close',            protectPOS, closeSession);
router.post('/sessions/:id/switch-cashier',   protectPOS, switchCashier);
router.get('/sessions/:id/orders',            protectPOS, getPOSSessionOrders);
router.get('/dashboard',                      protectPOS, getPOSDashboard);

// ── Admin-JWT protected ───────────────────────────────────────────────────────
// rejectPOSTokens ensures POS tokens can't slip through the protect() check.
router.use(rejectPOSTokens, protect, attachTenant, tenantUserOnly);

router.get('/sessions',  getSessionList);

// ── Tenant admins only ────────────────────────────────────────────────────────
router.get('/cashiers',        tenantAdminOrSuperAdmin, listCashiers);
router.post('/cashiers',       tenantAdminOrSuperAdmin, createCashier);
router.patch('/cashiers/:id',  tenantAdminOrSuperAdmin, updateCashier);
router.delete('/cashiers/:id', tenantAdminOrSuperAdmin, deleteCashier);

module.exports = router;
