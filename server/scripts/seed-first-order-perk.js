/**
 * seed-first-order-perk.js
 *
 * Creates the FIRSTDELIVERY coupon document that acts as the on/off switch for
 * free delivery on a customer's first purchase.
 *
 * The perk works without this document — it defaults to ON so the feature is
 * live the moment it deploys. Seeding it gives marketing a row in the existing
 * admin coupon UI where they can pause the offer (isActive: false), time-box it
 * (start/end dates), and watch uptake accumulate in the usage analytics.
 *
 * Safe to re-run: an existing document is left untouched.
 *
 *   node scripts/seed-first-order-perk.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const { FIRST_ORDER_PERK } = require('../services/firstOrderPerk.helpers');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  console.log('Connected.');

  const existing = await Coupon.findOne({ code: FIRST_ORDER_PERK.couponCode });
  if (existing) {
    console.log(`${FIRST_ORDER_PERK.couponCode} already exists (isActive: ${existing.isActive}) — leaving it alone.`);
    console.log('Set isActive:false on it to switch the offer off.');
    await mongoose.disconnect();
    return;
  }

  // Ten years out. The offer is meant to run indefinitely; the end date exists
  // because the Coupon schema requires one, not as a real expiry.
  const startDate = new Date();
  const endDate   = new Date(startDate.getFullYear() + 10, startDate.getMonth(), startDate.getDate());

  const coupon = await Coupon.create({
    code:        FIRST_ORDER_PERK.couponCode,
    name:        'Free Delivery on First Order',
    description: `Delivery waived (up to ₦${FIRST_ORDER_PERK.maxWaiver.toLocaleString()}) on a signed-in customer's first order of ₦${FIRST_ORDER_PERK.minSubtotal.toLocaleString()}+ delivered within ${FIRST_ORDER_PERK.states.join(', ')}.`,
    discountType: 'free_shipping',
    minimumPurchaseAmount: FIRST_ORDER_PERK.minSubtotal,
    firstPurchaseOnly: true,
    autoApply:   true,
    isGlobal:    true,
    isActive:    true,
    status:      'active',
    startDate,
    endDate,
    usageLimitPerUser: 1,
    internalNotes:
      'Switch for the first-order delivery waiver. The rule itself lives in ' +
      'services/firstOrderPerk.helpers.js — editing discountValue here has no effect. ' +
      'Set isActive:false to turn the offer off (takes up to 60s to propagate).',
  });

  console.log(`Created ${coupon.code} (${coupon._id}).`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
