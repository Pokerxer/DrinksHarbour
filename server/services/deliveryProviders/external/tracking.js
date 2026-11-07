'use strict';
const Booking = require('../../../models/MerchantCarrierBooking'),
  Event = require('../../../models/MerchantCarrierEvent'),
  { owned, bookingDTO, attach } = require('./bookings'),
  transport = require('./transport'),
  protocol = require('./protocol'),
  { hash, exact, key } = require('./scope'),
  { ConflictError, ForbiddenError } = require('../../../utils/errors');
async function fetchCurrent(row) {
  if (!/^SB-[A-Z0-9]{1,80}$/.test(row.providerId || ''))
    throw new ConflictError(
      'Known original provider shipment ID required; responsibility remains uncertain',
    );
  const data = await transport.request(row.account, `/shipping/labels/list/${row.providerId}`),
    matches = data?.results?.filter((r) => r.order_id === row.providerId);
  if (matches?.length !== 1)
    throw new ConflictError('Exact original provider tracking evidence unavailable');
  return matches[0];
}
async function refresh(id, actor) {
  const row = await owned(id, actor, true);
  if (row.state === 'uncertain' || row.state === 'submitting')
    throw new ConflictError('Platform financial reconciliation required');
  const view = await observe(row, await fetchCurrent(row));
  await require('../../merchantFulfillment/access').audit(row, actor, 'CARRIER_TRACKING_OBSERVED');
  return view;
}
async function observe(row, data) {
  const observation = protocol.observation(data, row.providerId);
  const id = hash([row._id, observation.status]);
  const session = await require('mongoose').startSession();
  try {
    await session.withTransaction(async () => {
      const saved = await Booking.findOne({
        _id: row._id,
        account: row.account,
        providerId: row.providerId,
      }).session(session);
      if (!saved) throw new ConflictError('Original carrier observation authority unavailable');
      const rank = {
        pending: 0,
        confirmed: 1,
        picked_up: 2,
        in_transit: 3,
        completed: 4,
        cancelled: 4,
      };
      if (
        ['completed', 'cancelled'].includes(saved.providerStatus) &&
        ['completed', 'cancelled'].includes(observation.status) &&
        saved.providerStatus !== observation.status
      )
        throw new ConflictError('Conflicting terminal carrier evidence requires review');
      await Event.updateOne(
        { _id: id },
        {
          $setOnInsert: {
            booking: row._id,
            account: row.account,
            providerId: row.providerId,
            kind: 'authenticated_tracking',
            status: observation.status,
          },
        },
        { upsert: true, session },
      );
      if ((rank[observation.status] ?? -1) >= (rank[saved.providerStatus] ?? -1)) {
        saved.providerStatus = observation.status;
        saved.lastObservedAt = new Date();
        if (observation.status === 'cancelled') saved.state = 'cancelled';
        await saved.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
  return bookingDTO(await Booking.findById(row._id).lean());
}
async function reconcile(id, input, actor) {
  require('../localDispatch/review').platform(actor);
  exact(input, []);
  const row = await owned(id, actor, true);
  if (!['submitting', 'uncertain'].includes(row.state)) return bookingDTO(row);
  return bookingDTO(await attach(row, await fetchCurrent(row)));
}
async function cancel(id, input, actor) {
  exact(input, ['idempotencyKey']);
  key(input.idempotencyKey);
  const row = await owned(id, actor, true);
  if (row.cancelKey) {
    if (row.cancelKey !== input.idempotencyKey)
      throw new ConflictError('Cancellation already attempted');
    return bookingDTO(row);
  }
  if (row.state !== 'booked' || row.scheduledFor <= new Date())
    throw new ConflictError('Only a future scheduled carrier booking may be cancelled');
  const data = await fetchCurrent(row);
  if (data.status !== 'pending')
    throw new ConflictError('Provider no longer permits scheduled cancellation');
  const claimed = await Booking.findOneAndUpdate(
    { _id: id, state: 'booked', cancelKey: { $exists: false } },
    { $set: { cancelKey: input.idempotencyKey, state: 'cancel_pending' } },
    { returnDocument: 'after' },
  ).lean();
  if (!claimed) {
    const latest = await owned(id, actor, true);
    if (latest.cancelKey !== input.idempotencyKey)
      throw new ConflictError('Cancellation already attempted');
    return bookingDTO(latest);
  }
  try {
    await transport.request(row.account, `/shipping/labels/cancel/${row.providerId}`, {});
    await Booking.updateOne(
      { _id: id, state: 'cancel_pending' },
      { $set: { state: 'cancel_requested' } },
    );
  } catch {
    /* Ambiguous cancel is not retryable and does not release budget. */
  }
  return bookingDTO(await owned(id, actor, true));
}
async function webhook(account, raw, signature) {
  if (!protocol.verifySignature(raw, signature, transport.secret(account)))
    throw new ForbiddenError('Invalid carrier signature');
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new ConflictError('Invalid carrier callback');
  }
  const providerId = body.order_id;
  if (!/^SB-[A-Z0-9]{1,80}$/.test(providerId || ''))
    throw new ConflictError('Unknown carrier shipment');
  const rows = await Booking.find({ account, providerId }).limit(2).lean();
  if (rows.length !== 1)
    throw new ConflictError('Unknown or ambiguous original carrier responsibility');
  const row = rows[0],
    id = hash(['callback', account, hash(raw.toString('base64'))]);
  if (await Event.exists({ _id: id })) return;
  if (['uncertain', 'submitting'].includes(row.state))
    throw new ConflictError('Platform reconciliation required');
  await observe(row, await fetchCurrent(row));
  await Event.updateOne(
    { _id: id },
    { $setOnInsert: { booking: row._id, account, providerId, kind: 'callback' } },
    { upsert: true },
  );
}
module.exports = { refresh, reconcile, cancel, webhook, fetchCurrent };
