// server/services/firstOrderPerk.service.js
//
// The database half of the first-purchase delivery waiver. The rule itself is
// pure and lives in firstOrderPerk.helpers.js; this module only answers the two
// questions the rule cannot answer on its own — is the offer switched on, and
// has this customer bought before — then composes the two.

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');
const {
  FIRST_ORDER_PERK,
  NON_PURCHASE_STATUSES,
  evaluateFirstOrderPerk,
} = require('./firstOrderPerk.helpers');

// The shipping quote refires on every keystroke in the address field, so the
// on/off lookup is cached. 60s is short enough that switching the offer off in
// the admin UI takes effect while the operator is still watching.
const ENABLED_CACHE_MS = 60_000;
let enabledCache = { value: null, at: 0 };

/** Reset the on/off cache. Exists for tests and for the seed script. */
function clearPerkCache() {
  enabledCache = { value: null, at: 0 };
}

/**
 * Is the offer currently running?
 *
 * A `FIRSTDELIVERY` coupon document is the kill switch, not the definition: when
 * no such document exists the perk is ON, so the feature works the moment it
 * deploys rather than waiting on someone to seed a record. Creating the document
 * lets marketing pause the offer (`isActive: false`) or time-box it (start/end
 * dates) from the coupon UI they already use.
 */
async function isPerkEnabled() {
  const now = Date.now();
  if (enabledCache.value !== null && now - enabledCache.at < ENABLED_CACHE_MS) {
    return enabledCache.value;
  }

  let enabled = true;
  try {
    const coupon = await Coupon.findOne({ code: FIRST_ORDER_PERK.couponCode })
      .select('isActive status startDate endDate')
      .lean();

    if (coupon) {
      const started = !coupon.startDate || new Date() >= coupon.startDate;
      const ended   = coupon.endDate && new Date() > coupon.endDate;
      enabled = coupon.isActive !== false && coupon.status !== 'inactive' && started && !ended;
    }
  } catch (err) {
    // A lookup failure must not take delivery pricing down with it. Failing
    // open is the cheaper mistake: the customer gets a perk they may not be
    // owed, rather than the whole checkout erroring.
    console.warn('[FirstOrderPerk] enabled lookup failed, defaulting to on:', err.message);
    enabled = true;
  }

  enabledCache = { value: enabled, at: now };
  return enabled;
}

/**
 * Has this user ordered before?
 *
 * Deliberately stricter than `Coupon.firstPurchaseOnly`, which counts only
 * completed/delivered orders and can therefore be farmed by placing several
 * orders before any of them ships.
 */
async function hasPriorOrder(userId) {
  if (!userId) return false;
  if (!mongoose.Types.ObjectId.isValid(userId)) return false;

  const existing = await Order.exists({
    user: userId,
    status: { $nin: NON_PURCHASE_STATUSES },
  });
  return !!existing;
}

/**
 * Resolve the waiver for a specific customer and basket.
 *
 * @param {object} params
 * @param {object|null} params.user      - `req.user`, or null for a guest
 * @param {number} params.subtotal       - cart subtotal, NGN
 * @param {string} params.state          - delivery state
 * @param {number|null} [params.baseFee] - quoted delivery fee before the waiver;
 *   omit when no address is known yet (the marketing surfaces)
 *
 * @returns {Promise<{eligible, waivedAmount, payableFee, reason, minSubtotal, maxWaiver, states}>}
 */
async function resolveFirstOrderPerk({ user, subtotal, state, baseFee = null }) {
  const userId = user?._id || user?.id || null;

  // Only pay for the two lookups when there is a customer who could qualify.
  const [enabled, priorOrder] = userId
    ? await Promise.all([isPerkEnabled(), hasPriorOrder(userId)])
    : [true, false];

  const verdict = evaluateFirstOrderPerk({
    signedIn: !!userId,
    enabled,
    hasPriorOrder: priorOrder,
    subtotal,
    state,
    baseFee,
  });

  return {
    ...verdict,
    minSubtotal: FIRST_ORDER_PERK.minSubtotal,
    maxWaiver:   FIRST_ORDER_PERK.maxWaiver,
    states:      FIRST_ORDER_PERK.states,
  };
}

/**
 * Record a granted waiver against the coupon document, when one exists, so
 * uptake shows up in the coupon analytics the admin UI already renders.
 *
 * Best-effort by design: an analytics write must never fail an order that has
 * already been paid for.
 */
async function recordPerkUsage({ userId, orderId, orderAmount, waivedAmount }) {
  try {
    const coupon = await Coupon.findOne({ code: FIRST_ORDER_PERK.couponCode });
    if (!coupon) return;
    await coupon.recordUsage(userId, orderAmount, waivedAmount, orderId);
  } catch (err) {
    console.warn('[FirstOrderPerk] usage record failed:', err.message);
  }
}

module.exports = {
  isPerkEnabled,
  hasPriorOrder,
  resolveFirstOrderPerk,
  recordPerkUsage,
  clearPerkCache,
};
