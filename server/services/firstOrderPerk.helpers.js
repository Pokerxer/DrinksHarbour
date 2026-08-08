// server/services/firstOrderPerk.helpers.js
//
// Free delivery on a customer's first purchase.
//
// Pure decision logic only — no database, no request objects. The DB half lives
// in firstOrderPerk.service.js. Keeping the rule here means the whole matrix of
// eligible/ineligible cases is unit-testable without a Mongo connection, and the
// shipping quote, the order write and the marketing surfaces all reach the same
// verdict from the same code.

/**
 * The offer. Amounts are NGN.
 *
 * These figures are the single source of truth: the client never hardcodes them,
 * it reads them off the shipping/perk API responses, so there is no second copy
 * to drift when marketing changes the terms.
 */
const FIRST_ORDER_PERK = {
  couponCode:  'FIRSTDELIVERY',
  minSubtotal: 50_000,
  maxWaiver:    5_000,
  states:      ['FCT - Abuja'],
};

/**
 * Order statuses that do NOT count as a prior purchase.
 *
 *   hold      — a saved cart, never paid for; recalling it deletes the order
 *   cancelled — the customer never received anything
 *
 * Everything else counts, `refunded` included: that was a real purchase that
 * happened to be reversed.
 */
const NON_PURCHASE_STATUSES = ['cancelled', 'hold'];

// The capital is spelled at least four different ways across the checkout form,
// the Google geocoder and the naija-state-local-government package. Normalise
// before comparing or the perk silently never fires for half of Abuja.
function normaliseState(state) {
  if (typeof state !== 'string') return '';
  const s = state.trim();
  if (!s) return '';
  if (/^(fct|abuja|federal capital territory|fct\s*-\s*abuja)$/i.test(s)) return 'FCT - Abuja';
  if (/federal capital territory|fct/i.test(s) || /abuja/i.test(s)) return 'FCT - Abuja';
  return s;
}

/** Does this state fall inside the perk's delivery zone? */
function isPerkState(state) {
  const normalised = normaliseState(state);
  return normalised !== '' && FIRST_ORDER_PERK.states.includes(normalised);
}

// Amounts arrive from query strings and request bodies, so they turn up as
// strings, as undefined, and occasionally as junk. Anything unparseable is 0 —
// never NaN, which would poison every downstream total.
function toAmount(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Decide whether an order qualifies for the first-purchase delivery waiver.
 *
 * @param {object}  input
 * @param {boolean} input.signedIn       - is there an authenticated user?
 * @param {boolean} input.enabled        - is the offer currently switched on?
 * @param {boolean} input.hasPriorOrder  - has this user ordered before?
 * @param {number}  input.subtotal       - cart subtotal, NGN
 * @param {string}  input.state          - delivery state
 * @param {number}  [input.baseFee]      - undelivered delivery fee, NGN. Pass
 *   null/undefined when it is not known yet (the perk probe has no address), and
 *   the fee-related checks are skipped.
 *
 * @returns {{ eligible: boolean, waivedAmount: number, payableFee: number, reason: string }}
 *   `reason` is `ok` when eligible, otherwise the single most actionable blocker.
 */
function evaluateFirstOrderPerk(input = {}) {
  const { signedIn, enabled, hasPriorOrder, subtotal, state, baseFee } = input;

  const feeKnown = baseFee !== null && baseFee !== undefined;
  const fee      = feeKnown ? toAmount(baseFee) : 0;

  // Ineligible orders pay the fee as quoted; a negative fee is a pricing bug
  // upstream and must not become a credit here.
  const fullFee = Math.max(0, Math.round(fee));
  const deny = (reason) => ({ eligible: false, waivedAmount: 0, payableFee: fullFee, reason });

  // Checked in priority order so the UI shows one clear next step. "Sign in"
  // outranks "spend more" — signing in costs the customer nothing.
  if (!signedIn)              return deny('not_signed_in');
  if (!enabled)               return deny('disabled');
  if (hasPriorOrder)          return deny('already_purchased');
  if (!isPerkState(state))    return deny('outside_zone');
  if (toAmount(subtotal) < FIRST_ORDER_PERK.minSubtotal) return deny('below_minimum');

  // Delivery is already free (a threshold order, or a fee we could not price):
  // there is nothing to give, and advertising a waiver here would be a lie.
  if (feeKnown && fee <= 0) return deny('no_fee');

  const payableFee   = Math.max(0, Math.round(fee - FIRST_ORDER_PERK.maxWaiver));
  const waivedAmount = fullFee - payableFee;

  return { eligible: true, waivedAmount, payableFee, reason: 'ok' };
}

module.exports = {
  FIRST_ORDER_PERK,
  NON_PURCHASE_STATUSES,
  normaliseState,
  isPerkState,
  evaluateFirstOrderPerk,
};
