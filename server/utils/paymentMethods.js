// utils/paymentMethods.js
//
// Single source of truth for order payment methods.
//
// These values used to be duplicated: once in the Order schema enum and once in
// the create-order route validator, and the two lists disagreed. The validator
// accepted 'bank' and 'cod' (which the schema rejects, so the order 500'd at
// save) while rejecting 'gift_card' (a live checkout option, so every gift-card
// order 400'd *after* the gift card had already been debited). Both lists now
// derive from here.

// Canonical methods — this IS the Order.paymentMethod schema enum.
const PAYMENT_METHODS = [
  'card',
  'bank_transfer',
  'mobile_money',
  'cash_on_delivery',
  'cash',
  'wallet',
  'gift_card',
  'split',
];

// Spellings accepted on the wire and folded into a canonical value on write.
// Keys cover legacy client shorthand ('bank', 'cod') and gateway channel names
// that have no distinct canonical method of their own — the raw gateway channel
// is still kept verbatim on `order.paymentDetails.channel`, so nothing is lost.
const PAYMENT_METHOD_ALIASES = {
  bank: 'bank_transfer',
  transfer: 'bank_transfer',
  banktransfer: 'bank_transfer',
  pay_with_bank: 'bank_transfer',
  paywithbank: 'bank_transfer',
  ussd: 'bank_transfer',
  cod: 'cash_on_delivery',
  cashondelivery: 'cash_on_delivery',
  giftcard: 'gift_card',
  mobilemoney: 'mobile_money',
  mobile_wallet: 'mobile_money',
};

// What the API will accept in a request body.
const ACCEPTED_PAYMENT_METHODS = [
  ...PAYMENT_METHODS,
  ...Object.keys(PAYMENT_METHOD_ALIASES),
];

/**
 * Fold any accepted spelling into a canonical schema value.
 * @returns {string|null} canonical method, or null when unrecognised.
 */
function normalizePaymentMethod(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return null;
  if (PAYMENT_METHODS.includes(key)) return key;
  return PAYMENT_METHOD_ALIASES[key] || PAYMENT_METHOD_ALIASES[key.replace(/_/g, '')] || null;
}

// Display labels, shared by the admin order list/detail and the customer
// my-account pages so one method never reads three different ways.
const PAYMENT_METHOD_LABELS = {
  card: 'Card Payment',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cash_on_delivery: 'Cash on Delivery',
  cash: 'Cash',
  wallet: 'DH Wallet',
  gift_card: 'Gift Card',
  split: 'Split Payment',
};

/**
 * Map an inbound `paymentDetails` payload onto the Order's top-level payment
 * columns.
 *
 * `paymentReference` is what both gateway webhooks look an order up by when the
 * customer pays and then closes the tab before the return page finishes. The
 * checkout return page sends the gateway reference as `transactionId`, not
 * `reference`, so reading only `reference` left gateway orders with no
 * paymentReference and the webhook safety net permanently unable to match.
 *
 * @param {object|null} paymentDetails
 * @returns {object} fields to merge into the order document
 */
function buildOrderPaymentFields(paymentDetails) {
  if (!paymentDetails || typeof paymentDetails !== 'object') return {};

  const fields = {};
  const reference = paymentDetails.reference || paymentDetails.transactionId;
  if (reference) fields.paymentReference = String(reference);

  if (paymentDetails.transactionId) {
    fields.paymentIntentId = String(paymentDetails.transactionId);
    // Stripe webhooks look up their own dedicated column.
    if (paymentDetails.method === 'stripe') {
      fields.stripePaymentIntentId = String(paymentDetails.transactionId);
    }
  }

  if (paymentDetails.paidAt) {
    const paidAt = new Date(paymentDetails.paidAt);
    if (!Number.isNaN(paidAt.getTime())) fields.paidAt = paidAt;
  }

  return fields;
}

module.exports = {
  buildOrderPaymentFields,
  PAYMENT_METHODS,
  PAYMENT_METHOD_ALIASES,
  PAYMENT_METHOD_LABELS,
  ACCEPTED_PAYMENT_METHODS,
  normalizePaymentMethod,
};
