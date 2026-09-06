#!/usr/bin/env node
// scripts/createSeedAdmin.js
//
// Create (or reset) a super_admin in the CURRENT database so the purchase
// seeder can advance orders to `delivered` and moderate reviews.
//
// Refuses to run against a database whose name does not end in `_seed`, unless
// --force is given. That guard is the whole point: this script writes a known
// password, so it must never land in the production database by accident.
//
// Usage:
//   node -r dotenv/config scripts/createSeedAdmin.js
//   node -r dotenv/config scripts/createSeedAdmin.js --email a@b.com --password 'Xy!23456'

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { parseArgv, get, bool } = require('./lib/flags');

// The User model stores `passwordHash` and has NO pre-save hashing hook —
// services/user.service.js hashes explicitly with bcrypt cost 12 (lines 73, 223)
// and login compares against `passwordHash` (line 280). Assigning a plain
// `password` field silently does nothing and makes every login throw
// "Illegal arguments: string, undefined". Hash here with the same cost.
const BCRYPT_COST = 12;

const DEFAULT_EMAIL = 'seed-admin@drinksharbour.test';
// Satisfies the register/reset validator: >=8 chars, upper, lower, digit, special.
const DEFAULT_PASSWORD = 'SeedAdmin1!';

async function main() {
  const args = parseArgv(process.argv.slice(2));
  const email = String(get(args, 'email') || DEFAULT_EMAIL).toLowerCase();
  const password = String(get(args, 'password') || DEFAULT_PASSWORD);
  const force = bool(get(args, 'force'));

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;

  if (!/_seed$/.test(dbName) && !force) {
    console.error(
      `✋ Database is "${dbName}", which does not end in "_seed".\n` +
      '   This script writes a known password and must not run against production.\n' +
      '   Re-run with --force only if you are certain.',
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const User = require('../models/User');

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  let user = await User.findOne({ email });
  if (user) {
    user.passwordHash = passwordHash;
    user.role = 'super_admin';
    user.isEmailVerified = true;
    user.status = 'active';
    user.isActive = true;
    user.mfaEnabled = false;
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = undefined;
    await user.save();
    console.log(`✓ Reset existing super_admin in "${dbName}"`);
  } else {
    user = await User.create({
      email,
      passwordHash,
      firstName: 'Seed',
      lastName: 'Admin',
      role: 'super_admin',
      isEmailVerified: true,
      status: 'active',
      isActive: true,
      mfaEnabled: false,
    });
    console.log(`✓ Created super_admin in "${dbName}"`);
  }

  console.log(`   email    : ${email}`);
  console.log(`   password : ${password}`);
  console.log(`   role     : ${user.role}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
