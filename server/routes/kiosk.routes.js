// server/routes/kiosk.routes.js
//
// Two audiences, two gates, in one deliberate order.
//
// `/session` is the ONLY route in this application authenticated by something
// other than a login, so the boundary is drawn before the admin chain is
// mounted rather than carved out of it afterwards. Everything below
// `router.use(protect)` is ordinary admin surface and inherits every gate.

const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');
const { authenticateKiosk } = require('../middleware/kiosk.middleware');

const c = require('../controllers/kiosk.controller');

const router = express.Router();

/**
 * Per IP, on the unauthenticated route only.
 *
 * Generous because a shop's screens can share one connection and this endpoint
 * is polled to keep the "on shift" count fresh; low enough that somebody
 * walking a device-id space is stopped long before they finish. The real
 * defence is the 256-bit secret — this is the brake on the attempt rate.
 */
const kioskSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this device. Please wait a moment.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

// ── Paired device, no login ──────────────────────────────────────────────────
router.get('/session', kioskSessionLimiter, authenticateKiosk, c.session);

// ── Everything below is an admin pairing screens ─────────────────────────────
router.use(protect);
router.use(attachTenant);
router.use(requireOwnTenant);
router.use(tenantAdminOrSuperAdmin);

router.route('/devices').get(c.listDevices).post(c.pairDevice);
router.delete('/devices/:deviceId', c.revokeDevice);

module.exports = router;
