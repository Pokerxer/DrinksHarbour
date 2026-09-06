// scripts/buildEmailSuppressionList.js
//
// Generate the outbound-email suppression list from the database.
//
// WHY THIS EXISTS
// Production holds 400 seeded customers carrying real consumer addresses
// (gmail.com / yahoo.com / yahoo.co.uk) attached to fabricated orders. Anything
// that mails a customer — an order-status change, a bulk send, a retry — would
// deliver mail about orders that never happened to people who never bought
// anything, from orders@drinksharbour.com.
//
// The blunt fix was OUTBOUND_EMAIL=off, which silences the platform entirely and
// also blocks password resets and verification codes for the 133 REAL users.
// This list replaces that: suppress the fabricated recipients, deliver to
// everyone else.
//
// Seeded customers are identified by `createdBy: <seedAdminId>` — the same
// selector the migration and rollback use.
//
// The output is a plain JSON file, checked in and human-editable, so the send
// path needs no database round trip and the list can be inspected and diffed.
// Re-run this after seeding or migrating more data.
//
// Usage:
//   node -r dotenv/config scripts/buildEmailSuppressionList.js
//   node -r dotenv/config scripts/buildEmailSuppressionList.js --dry-run

'use strict';

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const flagsLib = require('./lib/flags');

const SEED_ADMIN_ID = '6a9b17cc52ac39a73d004774';
const OUT = path.resolve(__dirname, '..', 'config', 'email-suppression.json');

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const conn = await mongoose.createConnection(uri).asPromise();

  const adminId = new mongoose.Types.ObjectId(SEED_ADMIN_ID);
  const seeded = await conn.db.collection('users')
    .find({ createdBy: adminId })
    .project({ email: 1, firstName: 1, lastName: 1 })
    .toArray();

  const addresses = [...new Set(seeded.map((u) => String(u.email).toLowerCase()))].sort();

  const domains = {};
  for (const a of addresses) {
    const d = a.split('@')[1] || '?';
    domains[d] = (domains[d] || 0) + 1;
  }

  const payload = {
    // Read by services/email.service.js at require time.
    version: 1,
    generatedAt: new Date().toISOString(),
    database: conn.db.databaseName,
    reason: 'Seeded//fabricated customers — real inboxes, fictitious orders. '
      + 'Do not deliver platform mail to these addresses.',
    selector: `createdBy: ObjectId("${SEED_ADMIN_ID}")`,
    count: addresses.length,
    domains,
    addresses,
  };

  console.log('▶ Building email suppression list');
  console.log(`   database  : ${conn.db.databaseName}`);
  console.log(`   suppressed: ${addresses.length}`);
  console.log(`   domains   : ${JSON.stringify(domains)}`);
  console.log(`   output    : ${OUT}`);
  console.log('');
  console.log('   sample:');
  for (const a of addresses.slice(0, 5)) console.log(`     ${a}`);

  if (dryRun) {
    console.log('\n   (dry run — nothing written)');
    await conn.close();
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`\n   ✓ written (${addresses.length} addresses)`);

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});
