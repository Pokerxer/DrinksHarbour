'use strict';
const { id } = require('./eligibility'); const { actorFor } = require('./legacy-guards'); const { fail } = require('./errors'); const { validateKey, fingerprint } = require('./operations');
async function checkoutBooking(tenant, actorId, booking, body) {
  const actor = await actorFor(tenant._id, actorId); const sessionId = id(booking.serviceSession);
  const key = validateKey(body.idempotencyKey);
  let visit = await require('../../models/VenueServiceSession').findOne({ _id: sessionId, tenant: tenant._id });
  if (!visit) fail('NOT_FOUND', 'Visit not found', 404);
  if (body.items?.length) {
    if (visit.acceptedLines.length) fail('STATE_CHANGED', 'Use the existing visit bill; booking items cannot replace its tab');
    const lines = [];
    for (const item of body.items) {
      const size = await require('../../models/Size').findOne({ _id: item.sizeId, tenant: tenant._id }).lean();
      if (!size) fail('NOT_FOUND', 'Size not found', 404);
      lines.push({ subProductId: id(size.subproduct), sizeId: id(size), quantity: item.quantity });
    }
    await require('./lines').setSessionLines({ tenantId: id(tenant), sessionId, actor, expectedVersion: body.expectedVersion, lines, idempotencyKey: fingerprint({ key, operation: 'accept' }) });
    visit = await require('../../models/VenueServiceSession').findOne({ _id: sessionId, tenant: tenant._id });
  }
  const bill = await require('./billing').ensureBillOrder({ tenantId: id(tenant), sessionId, actor, expectedVersion: body.items?.length ? visit.version : body.expectedVersion, lineVersion: body.items?.length ? visit.lineVersion : body.lineVersion, ageVerified: body.ageVerified, idempotencyKey: fingerprint({ key, operation: 'freeze' }) });
  const collection = await require('./collections').collectBill({ tenantId: id(tenant), sessionId, actor, expectedVersion: bill.version, quoteId: bill.quoteId, method: 'paystack', email: body.email, idempotencyKey: fingerprint({ key, operation: 'collect' }) });
  return { authorizationUrl: collection.authorizationUrl, orderId: collection.orderId, state: collection.state, bill: collection.bill };
}
async function reconcileBooking(order, actor) {
  const attempt = await require('../../models/VenuePaymentAttempt').findOne({ tenant: order.tenant, billOrder: order._id }).lean();
  if (!attempt) fail('PAYMENT_PENDING', 'No collection attempt exists');
  const receiptId = attempt.receipt || await require('./collections').verifyVenuePayment({ reference: attempt.reference });
  return require('./settlement').settleVenueBill({ tenantId: id(order.tenant), receiptId: id(receiptId), actor });
}
module.exports = { checkoutBooking, reconcileBooking };
