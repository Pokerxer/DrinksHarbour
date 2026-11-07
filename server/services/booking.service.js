const Booking = require('../models/Booking');
const { BOOKING_TRANSITIONS } = require('../models/Booking');
const { ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

function canTransition(from, to) {
  return Boolean(BOOKING_TRANSITIONS[from]?.includes(to));
}

// Venue workspace list. Cursor pagination is ADDITIVE: callers that pass
// `limit` opt into paging (page size 1–100) and walk it with `after`, while the
// default (legacy) callers keep receiving the whole chain for the filter, now
// hard-capped at 1000 rows as an unbounded-DoS guard. Sort is stable by
// (bookingAt, _id) so paging and re-fetching never reorder equal timestamps.
const BOOKING_LIST_LEGACY_CAP = 1000;
const BOOKING_LIST_PAGE_MAX = 100;
function encodeBookingCursor(row) {
  const at = new Date(row.bookingAt).toISOString();
  return Buffer.from(JSON.stringify({ at, id: String(row._id) }), 'utf8').toString('base64url');
}
function decodeBookingCursor(after) {
  let cursor;
  try { cursor = JSON.parse(Buffer.from(String(after), 'base64url').toString('utf8')); }
  catch { throw new ValidationError('Invalid pagination cursor; re-read the list'); }
  if (!cursor || typeof cursor.at !== 'string' || !Number.isFinite(new Date(cursor.at).getTime())
    || typeof cursor.id !== 'string' || !/^[a-f\d]{24}$/i.test(cursor.id)) {
    throw new ValidationError('Invalid pagination cursor; re-read the list');
  }
  cursor.at = new Date(cursor.at);
  return cursor; // _id stays a canonical 24-hex string; Mongoose casts it in queries.
}
async function listBookings(tenantId, { status, from, to, limit, after } = {}) {
  const query = { tenant: tenantId };
  if (status) {
    if (typeof status !== 'string' || !Object.hasOwn(BOOKING_TRANSITIONS, status)) throw new ValidationError('Invalid booking status');
    query.status = status;
  }
  if (from || to) {
    query.bookingAt = {};
    for (const date of [from, to].filter(Boolean)) {
      if (typeof date !== 'string' || !Number.isFinite(new Date(date).getTime())) throw new ValidationError('Invalid date filter');
    }
    if (from) query.bookingAt.$gte = new Date(from);
    if (to) query.bookingAt.$lte = new Date(to);
  }
  const sort = { bookingAt: 1, _id: 1 };
  const paged = limit !== undefined && limit !== null && limit !== '';
  if (paged) {
    const page = Number(limit);
    if (!Number.isInteger(page) || page < 1 || page > BOOKING_LIST_PAGE_MAX) {
      throw new ValidationError(`limit must be an integer from 1 to ${BOOKING_LIST_PAGE_MAX}`);
    }
    if (after) {
      const cursor = decodeBookingCursor(after);
      query.$or = [
        { bookingAt: { $gt: cursor.at } },
        { bookingAt: cursor.at, _id: { $gt: cursor.id } },
      ];
    }
    const rows = await Booking.find(query).sort(sort).limit(page + 1).lean();
    return { items: rows.slice(0, page), next: rows.length > page && rows[page - 1] ? encodeBookingCursor(rows[page - 1]) : null };
  }
  const rows = await Booking.find(query).sort(sort).limit(BOOKING_LIST_LEGACY_CAP).lean();
  return rows;
}

async function getBookingFor(tenantId, id) {
  const booking = await Booking.findOne({ _id: id, tenant: tenantId }).lean();
  if (!booking) throw new NotFoundError('Booking not found');
  return booking;
}

// Shared by customer (validated again in services/venue/experience-validation)
// and admin paths. The workspace form is free-text, so the API must bound what
// the schema does not (schema stores plain strings). Values must be copied into
// bounded, trimmed fields — anything longer is rejected with a 400 that names
// the field and the fix, instead of silently truncating or filling the DB.
const BOOKING_TEXT_LIMITS = {
  guestName: 120, // matches validateRequest in services/venue/experience-validation.js
  guestPhone: 40,
  guestEmail: 200,
  tableLabel: 60,
  notes: 2000,
};
function boundedText(value, name, max, options = {}) {
  const missing = value === undefined || value === null;
  if (missing) return options.required ? { fail: 'is required' } : { value: undefined };
  if (typeof value !== 'string') return { fail: `must be text` };
  const trimmed = value.trim();
  if (options.required && !trimmed) return { fail: 'is required' };
  if (trimmed.length > max) return { fail: `must be ${max} characters or fewer (currently ${trimmed.length}); shorten the ${name} and resubmit` };
  return { value: trimmed };
}
exports.boundedText = boundedText;
exports.BOOKING_TEXT_LIMITS = BOOKING_TEXT_LIMITS;

async function createBookingFor(tenantId, actorId, body, trusted = {}) {
  const guestName  = body?.guest?.name;
  const guestPhone = body?.guest?.phone;
  const guestEmail = body?.guest?.email;

  const name = boundedText(guestName, 'guest name', BOOKING_TEXT_LIMITS.guestName, { required: true });
  if (name.fail) throw new ValidationError(`Guest name ${name.fail}`);
  const phone = boundedText(guestPhone, 'guest phone', BOOKING_TEXT_LIMITS.guestPhone, { required: true });
  if (phone.fail) throw new ValidationError(`Guest phone ${phone.fail}`);
  const email = boundedText(guestEmail, 'guest email', BOOKING_TEXT_LIMITS.guestEmail, {});
  if (email.fail) throw new ValidationError(`Guest email ${email.fail}`);
  else if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    throw new ValidationError('Guest email must be a valid address like guest@example.com');
  }

  const partySize = Number(body?.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
    throw new ValidationError('partySize must be an integer between 1 and 100');
  }

  const bookingAt = new Date(body?.bookingAt);
  if (!body?.bookingAt || Number.isNaN(bookingAt.getTime())) {
    throw new ValidationError('bookingAt is required');
  }

  const source = trusted.source || (['pos', 'discovery', 'admin'].includes(body?.source) ? body.source : 'pos');
  let location;
  if (body?.location) {
    require('./venue/errors').requireId(body.location);
    const row = await require('../models/Warehouse').findOne({ _id: body.location, tenant: tenantId, isActive: true }).lean();
    if (!row?.venueServices?.enabled || !row.venueServices.reviewedAt) throw new NotFoundError('Venue location not found');
    location = row._id;
  }
  const durationMin = Number.isInteger(Number(body?.durationMin))
    ? Math.min(Math.max(Number(body.durationMin), 15), 480)
    : 120;

  const label = boundedText(body?.tableLabel, 'table label', BOOKING_TEXT_LIMITS.tableLabel, {});
  if (label.fail) throw new ValidationError(`Table label ${label.fail}`);
  const notes = boundedText(body?.notes, 'notes', BOOKING_TEXT_LIMITS.notes, {});
  if (notes.fail) throw new ValidationError(`Notes ${notes.fail}`);

  const booking = await Booking.create({
    tenant: tenantId,
    createdBy: actorId,
    guest: { name: name.value, phone: phone.value, email: email.value || undefined },
    partySize,
    bookingAt,
    durationMin,
    tableLabel: label.value || undefined,
    notes:      notes.value || undefined,
    status: 'pending',
    source,
    acquisitionAuthority: trusted.source ? 'server' : 'legacy',
    ...(location ? { location } : {}),
  });

  return booking.toObject();
}

async function setBookingStatusFor(tenantId, id, to, options = {}) {
  const booking = await Booking.findOne({ _id: id, tenant: tenantId });
  if (!booking) throw new NotFoundError('Booking not found');
  if (booking.serviceSession) {
    if (to === 'completed' && booking.status === 'completed') return booking.toObject();
    throw new ConflictError('Use canonical visit reconciliation for this booking');
  }
  if (booking.requestMode === 'request_only') throw new ConflictError('Use the versioned request workflow; future capacity confirmation is unavailable');
  if (to === 'checked_in' && !booking.location && !options.locationId) {
    const tenant = await require('../models/Tenant').findOne({ _id: tenantId }).select('venueSettings.identityVersion').lean();
    if (tenant?.venueSettings?.identityVersion === 1) throw new ConflictError('Choose a reviewed location and available table before check-in');
  }
  if (to === 'checked_in' && (booking.location || options.locationId)) {
    const locationId = String(booking.location || options.locationId);
    const location = await require('../models/Warehouse').findOne({ _id: locationId, tenant: tenantId }).lean();
    if (location?.venueServices?.canonicalCheckoutEnabled) {
      const actor = options.actor || await require('./venue/legacy-guards').actorFor(tenantId, options.actorId);
      await require('./venue/service-sessions').ensureServiceSession({ tenantId: String(tenantId), locationId, actor, bookingId: String(booking._id), tableIds: options.tableIds, expectedTableVersions: options.expectedTableVersions, posSessionId: options.posSessionId, idempotencyKey: options.idempotencyKey });
      return Booking.findOne({ _id: id, tenant: tenantId }).lean();
    }
  }
  const from = booking.status;
  if (to === 'completed' && from === 'completed') return booking.toObject();
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot move a ${from} booking to ${to}`);
  }
  if (to === 'completed') {
    const bill = await require('../models/Order').findOne({ tableServiceBooking: booking._id, tenant: tenantId }).select('paymentStatus').lean();
    if (!bill && booking.checkoutStartedAt) throw new ConflictError('Checkout is being prepared; reconcile it before completing the booking');
    if (bill && bill.paymentStatus !== 'paid') throw new ConflictError('Settle the table bill before completing the booking');
    if (bill) return require('./tableCheckout.service').completeTableBooking(tenantId, id);
  }
  booking.status = to;
  let updated;
  try { updated = await booking.save(); }
  catch (error) { if (error.name === 'VersionError') throw new ConflictError('Booking changed; reload and retry'); throw error; }
  return updated.toObject();
}

module.exports = {
  canTransition,
  listBookings,
  getBookingFor,
  createBookingFor,
  setBookingStatusFor,
  boundedText,
  BOOKING_TEXT_LIMITS,
  BOOKING_LIST_LEGACY_CAP,
  BOOKING_LIST_PAGE_MAX,
};
