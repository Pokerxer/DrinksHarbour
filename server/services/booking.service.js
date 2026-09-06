const Booking = require('../models/Booking');
const { BOOKING_TRANSITIONS } = require('../models/Booking');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

function canTransition(from, to) {
  return Boolean(BOOKING_TRANSITIONS[from]?.includes(to));
}

async function listBookings(tenantId, { status, from, to } = {}) {
  const query = { tenant: tenantId };
  if (status) query.status = status;
  if (from || to) {
    query.bookingAt = {};
    if (from) query.bookingAt.$gte = new Date(from);
    if (to) query.bookingAt.$lte = new Date(to);
  }
  return Booking.find(query).sort({ bookingAt: 1 }).lean();
}

async function getBookingFor(tenantId, id) {
  const booking = await Booking.findOne({ _id: id, tenant: tenantId }).lean();
  if (!booking) throw new NotFoundError('Booking not found');
  return booking;
}

async function createBookingFor(tenantId, actorId, body) {
  const guestName  = String(body?.guest?.name ?? '').trim();
  const guestPhone = String(body?.guest?.phone ?? '').trim();
  const guestEmail = String(body?.guest?.email ?? '').trim();

  if (!guestName || !guestPhone) {
    throw new ValidationError('Guest name and phone are required');
  }

  const partySize = Number(body?.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    throw new ValidationError('partySize must be an integer between 1 and 100');
  }

  const bookingAt = new Date(body?.bookingAt);
  if (!body?.bookingAt || Number.isNaN(bookingAt.getTime())) {
    throw new ValidationError('bookingAt is required');
  }

  const source = ['pos', 'discovery', 'admin'].includes(body?.source) ? body.source : 'pos';
  const durationMin = Number.isInteger(Number(body?.durationMin))
    ? Math.min(Math.max(Number(body.durationMin), 15), 480)
    : 120;

  const booking = await Booking.create({
    tenant: tenantId,
    createdBy: actorId,
    guest: { name: guestName, phone: guestPhone, email: guestEmail || undefined },
    partySize,
    bookingAt,
    durationMin,
    tableLabel: String(body?.tableLabel ?? '').trim() || undefined,
    notes:      String(body?.notes ?? '').trim() || undefined,
    status: 'pending',
    source,
  });

  return booking.toObject();
}

async function setBookingStatusFor(tenantId, id, to) {
  const booking = await Booking.findOne({ _id: id, tenant: tenantId });
  if (!booking) throw new NotFoundError('Booking not found');
  const from = booking.status;
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot move a ${from} booking to ${to}`);
  }
  booking.status = to;
  const updated = await booking.save();
  return updated.toObject();
}

module.exports = {
  canTransition,
  listBookings,
  getBookingFor,
  createBookingFor,
  setBookingStatusFor,
};