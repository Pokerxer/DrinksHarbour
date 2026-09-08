'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const Tenant = require('../models/Tenant');
const { protect } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { createBookingFor } = require('../services/booking.service');
const PUBLIC_VENUE = { status: 'approved', subscriptionStatus: 'active', plan: 'venue' };
router.get('/', asyncHandler(async (req, res) => {
  const venues = await Tenant.find(PUBLIC_VENUE).select('_id name slug logo description city').limit(100).lean();
  res.json({ success: true, data: venues });
}));
router.post('/:slug/bookings', protect, rateLimit({ windowMs: 3600000, limit: 10 }), asyncHandler(async (req, res) => {
  const venue = await Tenant.findOne({ ...PUBLIC_VENUE, slug: req.params.slug }).select('_id').lean();
  if (!venue) throw new NotFoundError('Venue not available');
  const at = new Date(req.body.bookingAt).getTime();
  if (!Number.isFinite(at) || at <= Date.now() || at > Date.now() + 180 * 86400000) {
    throw new ValidationError('Choose a future date within 180 days');
  }
  const booking = await createBookingFor(venue._id, req.user._id, {
    guest: req.body.guest, partySize: req.body.partySize, bookingAt: req.body.bookingAt, source: 'discovery',
  });
  res.status(201).json({ success: true, data: { _id: booking._id, status: booking.status, bookingAt: booking.bookingAt } });
}));
module.exports = router;
