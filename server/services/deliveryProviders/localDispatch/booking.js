"use strict";
const mongoose = require("mongoose"),
  Booking = require("../../../models/MerchantDispatchBooking"),
  Budget = require("../../../models/MerchantDispatchBudget"),
  Quote = require("../../../models/MerchantDispatchQuote"),
  Contract = require("../../../models/MerchantLocalDispatchContract");
const access = require("../../merchantFulfillment/access"),
  { scope, coverage, enabled, hash, sid } = require("./quote"),
  { bookingDTO } = require("./projection"),
  {
    ConflictError,
    ValidationError,
    NotFoundError,
  } = require("../../../utils/errors");
function key(k) {
  if (typeof k !== "string" || !k.trim() || k.length > 128)
    throw new ValidationError("Stable dispatch idempotency key required");
}
async function owned(id, actor, session, write = false) {
  return access.assertOwned(
    await Booking.findOne({ _id: id, ...access.scope(actor, write) }).session(
      session || null,
    ),
    actor,
    write,
  );
}
async function getBooking(id, actor) {
  const row = await owned(id, actor);
  await access.audit(row, actor, "LOCAL_DISPATCH_BOOKING_READ");
  return bookingDTO(row);
}
async function bookDispatch(childId, input, actor) {
  access.scope(actor, true);
  key(input?.idempotencyKey);
  if (
    !mongoose.isValidObjectId(input.quoteId) ||
    (input.driverId && !mongoose.isValidObjectId(input.driverId)) ||
    Object.keys(input).some(
      (k) => !["quoteId", "driverId", "idempotencyKey"].includes(k),
    )
  )
    throw new ValidationError("Valid quote and optional own driver required");
  const bookingId = hash(["local_dispatch", childId, input.idempotencyKey]),
    fingerprint = hash([
      childId,
      String(input.quoteId),
      input.driverId || null,
    ]);
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const prior = await Booking.findOne({
        _id: bookingId,
        ...access.scope(actor, true),
      }).session(session);
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          throw new ConflictError("Dispatch operation key already used");
        result = bookingDTO(prior);
        await access.audit(prior, actor, "LOCAL_DISPATCH_BOOKING_REPLAYED", {
          session,
        });
        return;
      }
      enabled();
      const quote = await Quote.findOne({
        _id: input.quoteId,
        merchantOrder: childId,
        ...access.scope(actor, true),
      })
        .session(session)
        .lean();
      if (!quote) throw new NotFoundError("Scoped dispatch quote not found");
      if (quote.expiresAt <= new Date())
        throw new ConflictError("Dispatch quote expired");
      if (quote.bookedBy)
        throw new ConflictError("Dispatch quote already booked");
      const loaded = await scope(childId, quote.lines, actor, session),
        contract = await Contract.findById(quote.contract)
          .session(session)
          .lean();
      const latest = await Contract.findOne({
        tenant: loaded.child.tenant,
        location: loaded.child.location,
      })
        .sort({ version: -1 })
        .session(session)
        .lean();
      if (
        !contract ||
        contract.status !== "reviewed" ||
        contract.validUntil <= new Date() ||
        sid(latest?._id) !== sid(contract._id)
      )
        throw new ConflictError("Dispatch contract changed or revoked");
      const rule = coverage(
        contract,
        loaded.parent.shippingAddress,
        loaded.snapshot.requirements,
      );
      if (
        hash([loaded.baseHash, contract._id, contract.amountMinor, rule]) !==
        quote.scopeHash
      )
        throw new ConflictError("Dispatch quote scope changed");
      let budget = await Budget.findById(childId).session(session);
      if (!budget) {
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
      }
      if (
        budget.shippingMinor !== loaded.child.shippingMinor ||
        budget.reservedMinor + budget.committedMinor + quote.amountMinor >
          budget.shippingMinor
      )
        throw new ConflictError("Accepted shipping charge budget exceeded");
      const collision = await Booking.findOne({
        merchantOrder: childId,
        state: { $in: ["booked"] },
      }).session(session);
      if (collision)
        throw new ConflictError(
          "Merchant child already has a draft responsibility; dispatch or cancel it first",
        );
      budget.reservedMinor += quote.amountMinor;
      await budget.save({ session });
      const deliveryId = new mongoose.Types.ObjectId(bookingId.slice(0, 24));
      const [row] = await Booking.create(
        [
          {
            _id: bookingId,
            merchantOrder: childId,
            order: loaded.child.order,
            tenant: loaded.child.tenant,
            location: loaded.child.location,
            quote: quote._id,
            delivery: deliveryId,
            amountMinor: quote.amountMinor,
            currency: quote.currency,
            lines: quote.lines,
            expectedVersion: quote.expectedVersion,
            contractSnapshot: contract,
            scopeHash: quote.scopeHash,
            fingerprint,
            createdBy: actor._id,
          },
        ],
        { session },
      );
      await require("../../delivery.service").createManagedDelivery(
        row,
        loaded.parent,
        input.driverId,
        actor,
        { session },
      );
      await Quote.updateOne(
        { _id: quote._id },
        { $set: { bookedBy: bookingId } },
        { session },
      );
      await access.audit(row, actor, "LOCAL_DISPATCH_BOOKED", { session });
      result = bookingDTO(row);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
async function cancelBooking(id, input, actor) {
  key(input?.idempotencyKey);
  if (
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 300
  )
    throw new ValidationError("Dispatch cancellation reason required");
  return require("../../delivery.service").cancelManagedDelivery(
    id,
    input,
    actor,
  );
}
module.exports = { bookDispatch, getBooking, cancelBooking, owned };
