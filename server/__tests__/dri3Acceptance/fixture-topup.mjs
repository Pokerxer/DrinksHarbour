'use strict';
/**
 * DRI-3 helper — top-up the fixture storefront buyer's wallet so the checkout
 * journey can complete a real wallet payment. Run-once helper:
 *   node __tests__/dri3Acceptance/fixture-topup.mjs
 */
import { createRequire } from 'node:module';
const SERVER_DIR = '/Users/mac/Documents/drinksharbour/server';
const require = createRequire(SERVER_DIR + '/package.json');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI =
  process.env.DRINKSHARBOUR_DRI3_MONGO_URI ||
  'mongodb://127.0.0.1:29127/drinks_dri3_browser?replicaSet=venuePhase0';

await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;

// Make sure the fixture accounts still exist (accept the shared DRI-3 password).
const bcryptHash = await bcrypt.hash('Dri3-Fixture-Pass!2026', 10).then((h) => h);
const users = db.collection('users');

const buyer = await users.findOne({ email: 'buyer@dri3-fixture.test' });
if (!buyer) { console.error('buyer not found'); process.exit(1); }
await users.updateOne(
  { _id: buyer._id },
  { $set: { passwordHash: bcryptHash, platformWalletBalance: 500000, status: 'active', isEmailVerified: true } },
);

// Same for the five tenant owners (cheap recovery for a dropped session).
const owners = ['skyline-fashion', 'nova-electronics', 'glow-beauty', 'hearth-home', 'harbour-general'];
for (const slug of owners) {
  await users.updateMany(
    { email: `owner@${slug}.test` },
    { $set: { passwordHash: bcryptHash, status: 'active', isEmailVerified: true } },
  );
}
const sa = await users.updateOne(
  { email: 'superadmin@dri3-fixture.test' },
  { $set: { passwordHash: bcryptHash, status: 'active', isEmailVerified: true } },
);

const fresh = await users.findOne({ _id: buyer._id }, { platformWalletBalance: 1 });
console.log('fixture-topup: buyer wallet =', fresh.platformWalletBalance, 'superadmin matched =', sa.matchedCount);
await mongoose.disconnect();
