// server/services/platformLoyalty.service.js
//
// The atomic DB layer for the platform-wide (ecommerce) "Corks & Points" loyalty
// program. Mirrors loyalty.service.js / platformWallet.service.js: a guarded,
// atomic $inc on User.loyaltyPoints (+ loyaltyLifetimePoints for earns) — for a
// debit-direction tx (redeem/expiry, or a negative adjustment) the filter requires
// `loyaltyPoints >= |delta|`, so concurrent debits can never drive it negative —
// paired with an append-only PlatformLoyaltyTransaction row whose `balanceAfter`
// is read straight back from the DB. The tier is recomputed from the new lifetime
// total on each earn and stored on the User for fast reads. If the ledger write
// fails, the balance move(s) and tier update are undone.

const User = require('../models/User');
const PlatformLoyaltyTransaction = require('../models/PlatformLoyaltyTransaction');
const { loyaltyDelta, affectsLifetime, tierFromLifetimePoints } = require('./platformLoyalty.helpers');

/**
 * Atomically move the loyalty-points balance, update the lifetime total (on earns)
 * and the tier, and append the matching ledger row.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {object} args.value  { type, points, reason } (as from validatePlatformLoyaltyTx).
 * @param {string} [args.reference]
 * @param {*}      [args.relatedOrder]
 * @param {*}      [args.redeemedAtTenant]
 * @param {*}      [args.createdBy]
 * @returns {Promise<{ ok:true, balance:number, lifetime:number, tier:string, tx:object }
 *                  | { ok:false, status:number, message:string }>}
 */
async function mutatePlatformLoyalty({
  userId, value, reference, relatedOrder, redeemedAtTenant, createdBy, session,
}) {
  const { type, points, reason } = value;
  const delta = loyaltyDelta(type, points);
  const lifetime = affectsLifetime(type) ? Math.abs(delta) : 0;

  const query = { _id: userId };
  if (delta < 0) query.loyaltyPoints = { $gte: -delta }; // atomic overdraw guard

  const inc = { loyaltyPoints: delta };
  if (lifetime > 0) inc.loyaltyLifetimePoints = lifetime;

  const updated = await User.findOneAndUpdate(query, { $inc: inc }, { new: true, ...(session ? { session } : {}) })
    .select('loyaltyPoints loyaltyLifetimePoints loyaltyTier');

  if (!updated) {
    return {
      ok: false,
      status: delta < 0 ? 400 : 404,
      message: delta < 0 ? 'Insufficient loyalty points' : 'User not found',
    };
  }

  // Recompute and persist the tier from the new lifetime total. Cheap and rare.
  const newTier = tierFromLifetimePoints(updated.loyaltyLifetimePoints);
  let tierChanged = false;
  if (newTier !== updated.loyaltyTier) {
    await User.updateOne(
      { _id: updated._id },
      { $set: { loyaltyTier: newTier, loyaltyTierUpdatedAt: new Date() } },
      session ? { session } : undefined
    );
    updated.loyaltyTier = newTier;
    tierChanged = true;
  }

  try {
    const entry = {
      userId,
      type,
      points,
      balanceAfter: updated.loyaltyPoints,
      relatedOrder,
      redeemedAtTenant: redeemedAtTenant || null,
      reason: reason || '',
      reference,
      createdBy,
    };
    const tx = session
      ? (await PlatformLoyaltyTransaction.create([entry], { session }))[0]
      : await PlatformLoyaltyTransaction.create(entry);
    return {
      ok: true,
      balance: updated.loyaltyPoints,
      lifetime: updated.loyaltyLifetimePoints,
      tier: updated.loyaltyTier,
      tierChanged,
      tx,
    };
  } catch (err) {
    if (session) throw err; // The caller rolls back the full settlement.
    // Ledger write failed — undo the balance + lifetime moves to stay consistent.
    const undo = { loyaltyPoints: -delta };
    if (lifetime > 0) undo.loyaltyLifetimePoints = -lifetime;
    await User.updateOne({ _id: updated._id }, { $inc: undo });
    throw err;
  }
}

// Marketplace purchases earn one base point per ₦100 at the customer's tier.
async function earnPaidMarketplaceOrder(order, { session } = {}) {
  if (order.paymentStatus !== 'paid' || !order.user) return;
  const userId = order.user._id ?? order.user;
  const query = User.findOne({ _id: userId, role: 'customer', tenant: null }).select('loyaltyTier');
  if (session) query.session(session);
  const user = await query.lean();
  if (!user) return;
  const points = require('./platformLoyalty.helpers').pointsForSpend((order.totalAmount || 0) * (1 / 100), user.loyaltyTier);
  if (!points) return;
  const result = await mutatePlatformLoyalty({
    userId, session, relatedOrder: order._id, createdBy: userId,
    value: { type: 'earn', points, reason: `Order ${order.orderNumber} — ₦${order.totalAmount.toLocaleString()} spent` },
  });
  if (!result.ok) throw new Error(result.message);
  return result;
}

module.exports = { mutatePlatformLoyalty, earnPaidMarketplaceOrder };