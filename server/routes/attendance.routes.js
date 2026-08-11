// server/routes/attendance.routes.js
//
// The clock. Admin-gated and tenant-locked exactly like the roster:
// requireOwnTenant stops a super_admin carrying a tenant claim from writing
// another tenant's timesheets, and tenantAdminOrSuperAdmin keeps ordinary staff
// out of everyone else's hours.
//
// The kiosk used to be NOT an exception to that: the device was signed in as a
// manager, so the JWT said which tenant, and the credential in the body (a
// badge or a PIN) said which employee.
//
// A kiosk anybody can walk up to has no manager signed in, so that JWT is gone
// — and it was doing TWO jobs, naming the tenant and authorising the write. A
// paired DEVICE TOKEN now does both (see middleware/kiosk.middleware.js), and
// `/clock` takes either credential:
//
//   * an admin JWT — the in-app kiosk on a signed-in tablet, unchanged, every
//     gate it always had;
//   * a device token — a screen on the counter, tenant named by the token,
//     badge scans only (a typed PIN on a public endpoint is a guessable secret;
//     the rule is resolveClockCredential in services/attendance.helpers.js).
//
// Everything ELSE in this file — the log, the corrections, one person's history
// — stays admin-only. A device token buys the ability to punch and nothing more.
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
} = require('../middleware/auth.middleware');
const { kioskOrAdmin } = require('../middleware/kiosk.middleware');

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

/**
 * A SECOND ceiling, keyed on the device rather than the IP.
 *
 * clockLimiter is per-IP, and per-IP was a fair brake while the endpoint sat
 * behind a login — an attacker had to hold an admin account first. It is not a
 * defence on its own against a script spread over many addresses, which is
 * exactly what a public endpoint invites, and every one of those requests
 * carries the SAME device token.
 *
 * So a paired screen gets its own budget: a whole team changing over is a few
 * dozen scans in a quarter of an hour from one device, and a script walking the
 * 8-digit badge space is stopped whatever address it comes from. Devices are
 * counted separately from each other, so one busy counter cannot lock out the
 * warehouse door.
 */
const kioskDeviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `kiosk:${req.kioskDevice?._id ?? 'unpaired'}`,
  // Only the token path is metered here; a signed-in manager is already
  // covered by clockLimiter and by having had to log in at all.
  skip: (req) => !req.kioskDevice,
  message: { success: false, message: 'Too many attempts from this device. Please wait a moment.' },
  validate: { xForwardedForHeader: false, forwardedHeader: false },
});

// Declared before the admin chain below, and before '/:id' so 'clock' is never
// read as an id. kioskOrAdmin runs ONE whole chain or the other — the admin
// gates are handed to it intact rather than being loosened.
router.post('/clock', clockLimiter, kioskOrAdmin, kioskDeviceLimiter, c.clock);

router.use(protect);
router.use(attachTenant);
router.use(requireOwnTenant);
router.use(tenantAdminOrSuperAdmin);

// One person's history and the rating it adds up to. Also declared ahead of
// '/:id' so 'employee' cannot be mistaken for a record id.
router.get('/employee/:employeeId', c.employeeHistory);

router.route('/').get(c.list).post(c.create);
router.route('/:id').patch(c.update).delete(c.remove);

module.exports = router;
