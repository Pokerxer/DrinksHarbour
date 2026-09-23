// Explicit, tenant-scoped password reset. Supply TARGET_USER_ID and NEW_PASSWORD
// through the environment and pass --apply. Never prints the password.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const TENANT = '699165839f3308b1baeca8fc';

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to reset the explicitly selected account');
  const { TARGET_USER_ID, NEW_PASSWORD } = process.env;
  if (!mongoose.isValidObjectId(TARGET_USER_ID)) throw new Error('TARGET_USER_ID must be an exact user id');
  if (!NEW_PASSWORD || NEW_PASSWORD.length < 12) throw new Error('NEW_PASSWORD must contain at least 12 characters');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB_URL);
  try {
    const user = await User.findOne({ _id: TARGET_USER_ID, tenant: TENANT });
    if (!user) throw new Error('User not found in the expected tenant');
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);
    await User.updateOne({ _id: user._id, tenant: TENANT }, { $set: { passwordHash, passwordChangedAt: new Date() } });
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    console.log(`Password reset for user ${user._id}; existing sessions revoked.`);
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
