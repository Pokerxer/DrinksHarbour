// One-off: set the "salomi" (Salome Kumle) password inside the ckay tenant.
// Scoped by tenant + exact user id. Pass --apply to write.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const TARGET_USER_ID = '6ab5f02ced9ea4230c009164';
const NEW_PASSWORD = '123456';

async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply to write the password');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGODB_URL);
  try {
    const tenant = await Tenant.findOne({ slug: 'ckay' });
    if (!tenant) throw new Error('No tenant with slug "ckay"');
    const user = await User.findOne({ _id: TARGET_USER_ID, tenant: tenant._id }).select('+passwordHash');
    if (!user) throw new Error('User not found in ckay tenant');

    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);
    await User.updateOne(
      { _id: user._id, tenant: tenant._id },
      {
        $set: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          accountLockedUntil: null,
          lastFailedLogin: null,
          lastFailedLoginIp: null,
        },
      }
    );
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    console.log(`Password set for ${user.firstName} ${user.lastName} (${user.email}) in ckay tenant; sessions revoked.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });