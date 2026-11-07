'use strict';
const mongoose = require('mongoose'),
  Booking = require('../../../models/MerchantCarrierBooking'),
  Quote = require('../../../models/MerchantCarrierQuote'),
  Budget = require('../../../models/MerchantDispatchBudget'),
  Evidence = require('../../../models/MerchantCarrierEvidence');
const access = require('../../merchantFulfillment/access'),
  { load, enabled, exact, key, hash } = require('./scope'),
  { current } = require('./review'),
  transport = require('./transport'),
  protocol = require('./protocol'),
  { ConflictError, NotFoundError } = require('../../../utils/errors');
const bookingDTO = (r) => {
  if (
    typeof r._id !== 'string' ||
    typeof r.allocationId !== 'string' ||
    !Number.isSafeInteger(r.rate?.amountMinor) ||
    r.rate.amountMinor < 0 ||
    !Number.isSafeInteger(r.rate?.displayMinor) ||
    r.rate.displayMinor < 0
  )
    throw new ConflictError('Carrier booking financial evidence requires review');
  return {
    _id: r._id,
    allocationId: r.allocationId,
    state: [
      'submitting',
      'uncertain',
      'booked',
      'cancel_pending',
      'cancel_requested',
      'cancelled',
    ].includes(r.state)
      ? r.state
      : 'awaiting_update',
    providerStatus: [
      'pending',
      'confirmed',
      'picked_up',
      'in_transit',
      'completed',
      'cancelled',
    ].includes(r.providerStatus)
      ? r.providerStatus
      : null,
    currency: 'NGN',
    amountMinor: r.rate.amountMinor,
    displayMinor: r.rate.displayMinor,
    lastObservedAt: r.lastObservedAt instanceof Date ? r.lastObservedAt : null,
    createdAt: r.createdAt instanceof Date ? r.createdAt : null,
  };
};
async function owned(id, actor, write = false) {
  return access.assertOwned(
    await Booking.findOne({ _id: id, ...access.scope(actor, write) }).lean(),
    actor,
    write,
  );
}
function identity(row, data) {
  protocol.observation(data, data?.order_id);
  if (
    data.ship_from?.address !== row.snapshot.codes[0].address ||
    data.ship_to?.address !== row.snapshot.codes[1].address ||
    data.payment?.currency !== 'NGN' ||
    data.payment?.type !== 'wallet' ||
    data.payment?.status !== 'completed' ||
    protocol.minor(data.payment.shipping_fee) !== row.rate.amountMinor
  )
    throw new ConflictError('Original carrier address and exact wallet fee evidence required');
}
async function attach(row, data) {
  identity(row, data);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const claim = hash(['shipment', row.account, data.order_id]),
        prior = await Evidence.findById(claim).session(session).lean();
      if (prior && prior.booking !== row._id)
        throw new ConflictError('Provider shipment already claimed by another responsibility');
      if (!prior)
        await Evidence.create(
          [
            {
              _id: claim,
              booking: row._id,
              account: row.account,
              providerId: data.order_id,
              kind: 'identity',
              evidenceHash: hash([data.ship_from.address, data.ship_to.address, data.payment]),
            },
          ],
          { session },
        );
      const saved = await Booking.findById(row._id).session(session);
      if (!['submitting', 'uncertain'].includes(saved.state)) {
        if (saved.providerId !== data.order_id)
          throw new ConflictError('Original carrier shipment identity changed');
        return;
      }
      if (saved.providerId && saved.providerId !== data.order_id)
        throw new ConflictError('Original carrier shipment identity changed');
      saved.state = 'booked';
      saved.providerId = data.order_id;
      saved.providerStatus = data.status;
      saved.lastObservedAt = new Date();
      await saved.save({ session });
      const budget = await Budget.findById(row.merchantOrder).session(session);
      if (!budget || budget.reservedMinor < row.rate.amountMinor)
        throw new ConflictError('Carrier reservation evidence unavailable');
      budget.reservedMinor -= row.rate.amountMinor;
      budget.committedMinor += row.rate.amountMinor;
      await budget.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return Booking.findById(row._id).lean();
}
async function bookCarrier(childId, input, actor) {
  access.scope(actor, true);
  exact(input, ['quoteId', 'courierId', 'serviceCode', 'idempotencyKey']);
  key(input.idempotencyKey);
  const q = await Quote.findOne({
    _id: input.quoteId,
    merchantOrder: childId,
    ...access.scope(actor, true),
  }).lean();
  if (!q) throw new NotFoundError('Own carrier quote not found');
  const id = hash(['carrier-allocation', q.allocationId]),
    fingerprint = hash([
      childId,
      input.quoteId,
      input.courierId,
      input.serviceCode,
      input.idempotencyKey,
    ]);
  let row,
    created = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      created = false;
      const prior = await Booking.findById(id).session(session).lean();
      if (prior) {
        access.assertOwned(prior, actor, true);
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError('Allocation already has carrier responsibility');
        row = prior;
        return;
      }
      enabled();
      if (q.expiresAt <= new Date()) throw new ConflictError('Carrier quote expired');
      const loaded = await load(childId, q.allocationId, actor, session),
        review = await current(loaded.child, session);
      const origin = await require('../../../models/Warehouse').updateOne(
        { _id: loaded.child.location, tenant: loaded.child.tenant, isActive: true },
        { $inc: { __v: 1 } },
        { session },
      );
      if (origin.matchedCount !== 1)
        throw new ConflictError('Original carrier origin changed during booking');
      if (
        q.scopeHash !== loaded.scopeHash ||
        q.review !== review._id ||
        q.account !== review.account
      )
        throw new ConflictError('Original carrier quote scope changed');
      const childGuard = await require('../../../models/MerchantOrder').updateOne(
        { _id: childId, tenant: loaded.child.tenant, version: loaded.child.version },
        { $inc: { __v: 1 } },
        { session },
      );
      const parentGuard = await require('../../../models/Order').updateOne(
        {
          _id: loaded.child.order,
          user: loaded.parent.user,
          paymentStatus: loaded.parent.paymentStatus,
        },
        { $inc: { __v: 1 } },
        { session },
      );
      if (childGuard.matchedCount !== 1 || parentGuard.matchedCount !== 1)
        throw new ConflictError(
          'Original goods or payment authority changed during carrier booking',
        );
      const locked = await require('../../../models/MerchantShipmentAllocation').updateOne(
        {
          _id: q.allocationId,
          merchantOrder: childId,
          order: loaded.child.order,
          tenant: loaded.child.tenant,
          location: loaded.child.location,
          state: 'shipped',
          version: loaded.allocation.version,
        },
        { $inc: { __v: 1 } },
        { session },
      );
      if (locked.matchedCount !== 1)
        throw new ConflictError('Original goods allocation changed before carrier booking');
      const rate = q.rates.find(
        (r) => r.courierId === input.courierId && r.serviceCode === input.serviceCode,
      );
      if (!rate) throw new ConflictError('Quoted reviewed courier service required');
      let budget = await Budget.findById(childId).session(session);
      if (!budget)
        [budget] = await Budget.create(
          [
            {
              _id: childId,
              order: loaded.child.order,
              tenant: loaded.child.tenant,
              shippingMinor: loaded.child.shippingMinor,
            },
          ],
          { session },
        );
      if (
        budget.shippingMinor !== loaded.child.shippingMinor ||
        budget.reservedMinor +
          budget.committedMinor +
          Math.max(rate.amountMinor, rate.displayMinor) >
          budget.shippingMinor
      )
        throw new ConflictError('Accepted shipping charge budget exceeded');
      budget.reservedMinor += rate.amountMinor;
      await budget.save({ session });
      [row] = await Booking.create(
        [
          {
            _id: id,
            merchantOrder: childId,
            order: q.order,
            tenant: q.tenant,
            location: q.location,
            allocationId: q.allocationId,
            quote: q._id,
            account: q.account,
            review: q.review,
            scopeHash: q.scopeHash,
            snapshot: q.snapshot,
            rate: rate.toObject ? rate.toObject() : rate,
            fingerprint,
            state: 'submitting',
            scheduledFor: new Date(q.snapshot.pickupDate),
            createdBy: actor._id,
          },
        ],
        { session },
      );
      row = row.toObject();
      created = true;
      await access.audit(row, actor, 'CARRIER_BOOKING_RESERVED', { session });
    });
  } finally {
    await session.endSession();
  }
  if (!created) return bookingDTO(row);
  // Exactly one POST, outside retryable Mongo transaction. Any ambiguity retains reservation.
  try {
    const data = await transport.request(row.account, '/shipping/labels', {
      request_token: q.requestToken,
      service_code: row.rate.serviceCode,
      courier_id: row.rate.courierId,
      is_cod_label: false,
      duties_paid: false,
    });
    // Preserve a syntactically valid known ID before checking financial/address evidence.
    if (/^SB-[A-Z0-9]{1,80}$/.test(data?.order_id || ''))
      await Booking.updateOne(
        { _id: row._id, state: 'submitting' },
        { $set: { providerId: data.order_id } },
      );
    row = await attach(row, data);
  } catch {
    await Booking.updateOne(
      { _id: row._id, state: 'submitting' },
      { $set: { state: 'uncertain' } },
    );
    row = await Booking.findById(row._id).lean();
  }
  return bookingDTO(row);
}
module.exports = { bookCarrier, bookingDTO, owned, attach, identity };
