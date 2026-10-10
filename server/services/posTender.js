// services/posTender.js
//
// What tender names the POS accepts, and which of them settle against a
// customer's account.
//
// One authority, because the handler used to dispatch on a chain of
// `paymentMethod === 'cash'` comparisons with no allowlist at all. An
// unrecognised name then posted a perfectly normal-looking order: no cash
// counted, no wallet debited, no tab charged, nothing in the drawer. The list
// below was declared but never checked, and even omitted 'wallet' — which the
// same handler was written to handle.

/** Every tender name the POS will accept. */
const TENDER_METHODS = Object.freeze([
  'cash',
  'card',
  'bank_transfer',
  'mobile_money',
  'split',
  // Settles against the customer's account: store credit is spent first and any
  // remainder becomes a tab charge. See customerAccount.tender.
  'wallet',
  // The same tender under the name a cashier actually says. Alias, not a
  // separate path — see isAccountTender.
  'account',
]);

// A Set, but built from an own-property-safe list: `TENDER_METHODS.includes`
// is not the concern here, `normaliseTender` looking a string up on a plain
// object is. Inherited keys ('toString', 'constructor') must not read as tenders.
const ACCEPTED = new Set(TENDER_METHODS);

/**
 * Whether this tender settles against the customer's account.
 *
 * 'wallet' and 'account' are the same tender: both spend stored value first and
 * charge the remainder to the tab. They must route through one branch, or the
 * name a cashier taps silently stops collecting money.
 */
function isAccountTender(method) {
  return method === 'wallet' || method === 'account';
}

/**
 * @param {unknown} method the raw `paymentMethod` from the request body
 * @returns {string} the validated tender name
 * @throws {Error} on anything that is not a known tender
 */
function normaliseTender(method) {
  if (typeof method !== 'string' || !ACCEPTED.has(method)) {
    throw new Error(`Unknown payment method: ${JSON.stringify(method)}`);
  }
  return method;
}

module.exports = { TENDER_METHODS, isAccountTender, normaliseTender };