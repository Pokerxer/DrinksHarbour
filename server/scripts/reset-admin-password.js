/**
 * Reset admin password script
 * Usage: node scripts/reset-admin-password.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const ADMIN_EMAIL = 'admin@drinksharbour.com';
const NEW_PASSWORD = 'Admin@123!SecurePassword';

async function resetAdminPassword() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  const user = await users.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    console.error(`User not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (role: ${user.role})`);

  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  await users.updateOne(
    { email: ADMIN_EMAIL },
    {
      $set: {
        passwordHash: hash,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    }
  );

  console.log(`Password reset successfully for ${ADMIN_EMAIL}`);
  console.log(`New password: ${NEW_PASSWORD}`);
  await mongoose.disconnect();
}

resetAdminPassword().catch((err) => {
  console.error(err);
  process.exit(1);
});
