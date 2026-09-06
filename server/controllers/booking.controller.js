const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const bookingService = require('../services/booking.service');

exports.getBookings = asyncHandler(async (req, res) => {
  const rows = await bookingService.listBookings(req.tenant._id, {
    status: req.query.status,
    from:   req.query.from,
    to:     req.query.to,
  });
  successResponse(res, rows, 'Bookings loaded');
});

exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingFor(req.tenant._id, req.params.id);
  successResponse(res, booking);
});

exports.createBooking = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBookingFor(
    req.tenant._id,
    req.user._id,
    req.body
  );
  successResponse(res, booking, 'Booking created', 201);
});

exports.setBookingStatus = asyncHandler(async (req, res) => {
  const { to } = req.body;
  const booking = await bookingService.setBookingStatusFor(req.tenant._id, req.params.id, to);
  successResponse(res, booking, 'Booking updated');
});