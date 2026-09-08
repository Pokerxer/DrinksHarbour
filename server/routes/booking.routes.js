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
router.get('/menu', require('../utils/asyncHandler')(async (req, res) => {
  res.json({ success: true, data: await require('../services/tableCheckout.service').tableMenu(req.tenant._id) });
}));
router.post('/:id/checkout', require('../utils/asyncHandler')(async (req, res) => {
  res.json({ success: true, data: await require('../services/tableCheckout.service').startTableCheckout(req.tenant, req.user._id, req.params.id, req.body) });
}));
router.post('/:id/reconcile-payment', require('../utils/asyncHandler')(async (req, res) => {
  const order = await require('../models/Order').findOne({ tableServiceBooking: req.params.id, tenant: req.tenant._id });
  if (!order) throw new (require('../utils/errors').NotFoundError)('Bill not found');
  await require('../services/tableCheckout.service').settleTablePayment(order);
  res.json({ success: true });
}));
router.post('/',  ctrl.createBooking);
router.get('/:id',          ctrl.getBooking);
router.patch('/:id/status', ctrl.setBookingStatus);

module.exports = router;
