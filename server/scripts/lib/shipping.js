// scripts/lib/shipping.js
//
// Compute a shipping fee that the order controller's fee-floor check will
// accept.
//
// server/controllers/order.controller.js runs:
//   const zoneQuote = calculateShipping(deliveryState, deliveryLga, subtotal);
//   const feeFloor  = zoneQuote.isFree ? 0 : Math.min(zoneQuote.fee, DISTANCE_MIN_FEE);
//   if (quotedBaseFee < feeFloor) return 400;
// so posting `shippingFee: 0` on a non-free order 400s. Using the same helper
// the server uses is the only way to guarantee we send a fee at or above the
// floor without duplicating (and drifting from) the zone tables.

const { calculateShipping } = require('../../data/shipping-zones');

/**
 * @param {object} address    { state, lga, city }
 * @param {number} subtotal   order subtotal in the same currency the server uses
 * @returns {{ shippingFee: number, shippingInfo: { baseFee: number }, isFree: boolean }}
 */
function quoteShipping(address, subtotal) {
  const state = address?.state || '';
  const lga = address?.lga || address?.city || '';
  const quote = calculateShipping(state, lga, subtotal);
  const fee = quote.isFree ? 0 : Math.max(0, Math.round(quote.fee));
  return {
    shippingFee: fee,
    // shippingInfo.baseFee is the pre-waiver fee the client displayed. In the
    // seeder there is no waiver, so it matches shippingFee. The order controller
    // enforces baseFee >= feeFloor, not shippingFee, so this MUST be set.
    shippingInfo: { baseFee: fee },
    isFree: !!quote.isFree,
  };
}

module.exports = { quoteShipping };
