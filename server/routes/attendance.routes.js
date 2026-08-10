// server/routes/attendance.routes.js
//
// The clock. Admin-gated and tenant-locked exactly like the roster:
// requireOwnTenant stops a super_admin carrying a tenant claim from writing
// another tenant's timesheets, and tenantAdminOrSuperAdmin keeps ordinary staff
// out of everyone else's hours.
//
// The kiosk is NOT an exception to that. The device is signed in as a manager,
// so the JWT says which tenant; the credential in the body (a badge or a PIN)
// says which employee. That split is why /clock can be behind the same guards
// as the log and still be usable by a driver who has no admin account of their
// own — and, with a badge, no PIN either.
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');

const c = require('../controllers/attendance.controller');

const router = express.Router();

/**
 * The pad is a PIN oracle if it is left unmetered — a screen in a shop, and a
 * PIN is short. Shaped after loginLimiter in user.routes.js, but per-shift
 * rather than per-attempt: a busy handover is a dozen presses in a few minutes
 * from one device, so the ceiling is generous while still ending a script.
 */
const clockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 presses per IP per 15 min — a whole team changing over, not a guesser
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts from this device. Please wait a moment.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

router.use(protect);
router.use(attachTenant);
router.use(requireOwnTenant);
router.use(tenantAdminOrSuperAdmin);

// Declared before '/:id' so 'clock' is never read as an id.
router.post('/clock', clockLimiter, c.clock);

// One person's history and the rating it adds up to. Also declared ahead of
// '/:id' so 'employee' cannot be mistaken for a record id.
router.get('/employee/:employeeId', c.employeeHistory);

router.route('/').get(c.list).post(c.create);
router.route('/:id').patch(c.update).delete(c.remove);

module.exports = router;
