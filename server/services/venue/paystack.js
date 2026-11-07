'use strict';
// Provider side effects stay outside MongoDB transaction callbacks.
const payments = require('../payment.service');
function returnPath(attempt, pos) { return pos ? `/pos/sell?venueSession=${encodeURIComponent(String(attempt.session))}` : `/venue-completion?visit=${encodeURIComponent(String(attempt.session))}`; }
async function initialize(attempt, email, { pos = false } = {}) {
  return payments.createPaystackTransaction(attempt.amountMinor / 100, email,
    { purpose: attempt.purpose || 'venue_bill', attemptId: String(attempt._id) },
    { reference: attempt.reference, callbackUrl: attempt.collectionVersion === 2 && attempt.payerPortion ? require('../../utils/frontendUrl').frontendUrl(`/venue-pay/${attempt.payerPortion}?token=${require('./payers').payerLinkToken(String(attempt.payerPortion), attempt.grantVersion)}`) : attempt.purpose === 'venue_deposit' ? require('../../utils/frontendUrl').frontendUrl(`/my-account/reservations/${encodeURIComponent(attempt.bookingReference)}`) : `${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}${returnPath(attempt, pos)}` });
}
async function verify(reference) { return payments.verifyPaystackTransaction(reference, {includeFailureIdentity:true}); }
module.exports = { initialize, verify, returnPath };
