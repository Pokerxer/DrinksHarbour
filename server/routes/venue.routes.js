'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { listPublicVenues, publicBookingTarget } = require('../services/venue/public-directory');
const { protect } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { createBookingFor } = require('../services/booking.service');
router.get('/', asyncHandler(async (req, res) => {
  const venues = await listPublicVenues();
  res.json({ success: true, data: venues });
}));
router.post('/:slug/bookings', protect, rateLimit({ windowMs: 3600000, limit: 10 }), asyncHandler(async (req, res) => {
  const venue = await publicBookingTarget(req.params.slug);
  if (!venue) throw new NotFoundError('Venue not available');
  const at = new Date(req.body.bookingAt).getTime();
  if (!Number.isFinite(at) || at <= Date.now() || at > Date.now() + 180 * 86400000) {
    throw new ValidationError('Choose a future date within 180 days');
  }
  const booking = await createBookingFor(venue._id, req.user._id, {
    guest: req.body.guest, partySize: req.body.partySize, bookingAt: req.body.bookingAt, source: 'discovery', location: req.body.location,
  }, { source: 'discovery' });
  res.status(201).json({ success: true, data: { _id: booking._id, status: booking.status, bookingAt: booking.bookingAt } });
}));
module.exports = router;
