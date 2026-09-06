const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/booking.controller');
const {
  protect,
  attachTenant,
  tenantAdminOrSuperAdmin,
  requireOwnTenant,
} = require('../middleware/auth.middleware');
const { requireCapability } = require('../middleware/plan.middleware');

router.use(protect);
router.use(attachTenant);
// Venue-owned: cross-tenant admin pivoting is not allowed here — only
// bookings belonging to the tenant on the JWT.
router.use(requireOwnTenant);
router.use(tenantAdminOrSuperAdmin);
// Venue-only feature: venue Discover, table booking and guest-list capture.
router.use(requireCapability('table_management'));

router.get('/',   ctrl.getBookings);
router.post('/',  ctrl.createBooking);
router.get('/:id',          ctrl.getBooking);
router.patch('/:id/status', ctrl.setBookingStatus);

module.exports = router;