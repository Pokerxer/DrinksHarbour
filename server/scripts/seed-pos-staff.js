/**
 * Seed POS staff for Premium Spirits & Wine tenant
 * Usage: node scripts/seed-pos-staff.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const TENANT_SLUG = 'premium-spirits-wine';

const STAFF = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    posName: 'Alice',
    email: 'alice@premium-spirits.test',
    pin: '1111',
    posPermissions: [
      'pos:sell',
      'pos:refund',
      'pos:terminal:retail',
    ],
  },
  {
    firstName: 'Bob',
    lastName: 'Martinez',
    posName: 'Bob',
    email: 'bob@premium-spirits.test',
    pin: '2222',
    posPermissions: [
      'pos:sell',
      'pos:refund',
      'pos:discount',
      'pos:terminal:retail',
      'pos:terminal:wholesale',
    ],
  },
];

async function seedPOSStaff() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const users = db.collection('users');

  const tenant = await db.collection('tenants').findOne({ slug: TENANT_SLUG });
  if (!tenant) {
    console.error(`Tenant not found: ${TENANT_SLUG}`);
    process.exit(1);
  }
  console.log(`Found tenant: ${tenant.name} (${tenant._id})`);

  for (const s of STAFF) {
    const existing = await users.findOne({ email: s.email });
    if (existing) {
      console.log(`Updating existing staff: ${s.email}`);
      await users.updateOne(
        { email: s.email },
        {
          $set: {
            firstName: s.firstName,
            lastName: s.lastName || '',
            posName: s.posName,
            role: 'tenant_staff',
            tenant: tenant._id,
            posAccess: true,
            posPermissions: s.posPermissions,
            status: 'active',
            isEmailVerified: true,
            posPinHash: await bcrypt.hash(s.pin, 10),
          },
        }
      );
    } else {
      console.log(`Creating staff: ${s.email}`);
      await users.insertOne({
        firstName: s.firstName,
        lastName: s.lastName || '',
        posName: s.posName,
        email: s.email.toLowerCase().trim(),
        role: 'tenant_staff',
        tenant: tenant._id,
        posAccess: true,
        posPermissions: s.posPermissions,
        status: 'active',
        isEmailVerified: true,
        isAgeVerified: false,
        passwordHash: await bcrypt.hash(Math.random().toString(36) + Date.now(), 10),
        posPinHash: await bcrypt.hash(s.pin, 10),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`  ${s.email} — PIN: ${s.pin} — terminals: ${s.posPermissions.filter(p => p.startsWith('pos:terminal:')).map(p => p.split(':')[2]).join(', ')}`);
  }

  console.log('\nDone. Staff summary:');
  console.log('  Alice (alice@premium-spirits.test) — PIN 1111 — Retail only');
  console.log('  Bob   (bob@premium-spirits.test)   — PIN 2222 — Retail + Wholesale');

  await mongoose.disconnect();
}

seedPOSStaff().catch((err) => {
  console.error(err);
  process.exit(1);
});
