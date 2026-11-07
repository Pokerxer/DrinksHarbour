'use strict';
const access = require('../../merchantFulfillment/access'),
  { bookingDTO, owned } = require('./bookings');
async function getOptions(childId, actor) {
  const child = access.assertOwned(
    await require('../../../models/MerchantOrder')
      .findOne({ _id: childId, ...access.scope(actor) })
      .lean(),
    actor,
  );
  const review = await require('../../../models/MerchantCarrierReview')
    .findOne({ tenant: child.tenant, location: child.location })
    .sort({ version: -1 })
    .lean();
  const allocations = await require('../../../models/MerchantShipmentAllocation')
    .find({
      merchantOrder: childId,
      tenant: child.tenant,
      location: child.location,
      state: 'shipped',
      dispatchBooking: { $exists: false },
    })
    .lean();
  const bookings = await require('../../../models/MerchantCarrierBooking')
    .find({ merchantOrder: childId, ...access.scope(actor) })
    .sort({ createdAt: -1 })
    .lean();
  return {
    enabled: process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED === 'true',
    review: review ? require('./review').reviewDTO(review) : null,
    ready:
      process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED === 'true' &&
      review?.status === 'reviewed' &&
      review.validUntil > new Date(),
    allocations: allocations.map((a) => ({
      _id: a._id,
      lines: a.lines.map((l) => ({ line: l.line, quantity: l.quantity })),
    })),
    bookings: bookings.map(bookingDTO),
  };
}
async function getBooking(id, actor) {
  return bookingDTO(await owned(id, actor));
}
module.exports = {
  ...require('./review'),
  ...require('./quotes'),
  ...require('./bookings'),
  ...require('./tracking'),
  getOptions,
  getBooking,
};
