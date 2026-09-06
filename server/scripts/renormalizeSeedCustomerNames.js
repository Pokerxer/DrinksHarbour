// scripts/renormalizeSeedCustomerNames.js
//
// Rewrite every seeded customer's identity to a clean, ethnicity-consistent
// "first + last only" name — no cross-ethnic composites (no "Chidi Mohammed",
// no "Musa Okonkwo").
//
// For each role:customer user in the seed DB it:
//   1. draws a fresh first+last pair from a SINGLE ethnic group
//      (igbo / hausa / yoruba — weighted ~34/32/34, pools in lib/fake-data.js);
//   2. guarantees that full name is unique across the customer set;
//   3. rebuilds the address as a consumer-shaped email derived from the new
//      name — mixed local-part styles (dotted, dotless, underscored, initials,
//      trailing digits) over a gmail/yahoo mix — preserving the password and
//      every other field;
//   4. pushes the new `firstName`/`lastName`/`displayName` and email onto the
//      user, and the new fullName + email onto every order's shippingAddress
//      for that user, so the historical book stays internally consistent.
//
// Safety:
//   * refuses any database whose name does not end in `_seed`;
//   * refuses to write consumer (gmail/yahoo) addresses unless outbound mail is
//     disabled — order.controller.js sends a confirmation per order and
//     email.service.js does NOT gate on NODE_ENV, so with live MAIL_*
//     credentials these would reach real strangers from the production domain.
//
// Usage:
//   node -r dotenv/config scripts/renormalizeSeedCustomerNames.js --dry-run
//   node -r dotenv/config scripts/renormalizeSeedCustomerNames.js
//   node -r dotenv/config scripts/renormalizeSeedCustomerNames.js --email-domain mail.test

'use strict';

const mongoose = require('mongoose');
const {
  allocateCustomerName, generateConsumerEmail, ETHNIC_GROUPS,
} = require('./lib/fake-data');

const flagsLib = require('./lib/flags');

async function main() {
  const args = flagsLib.parseArgv(process.argv.slice(2));
  const dryRun = flagsLib.bool(flagsLib.get(args, 'dry-run'));
  // null → draw from the consumer gmail/yahoo mix. Pass --email-domain to pin
  // every address to one domain (e.g. a .test domain you control).
  const forcedDomain = flagsLib.get(args, 'email-domain') || null;

  // Consumer addresses can reach real people, and the platform mails an order
  // confirmation per order. Refuse to stamp them in unless outbound mail is
  // provably off. See services/email.service.js — NODE_ENV is not consulted on
  // the send path.
  const outboundBlocked = (
    String(process.env.OUTBOUND_EMAIL || '').toLowerCase() === 'off' ||
    ['true', '1', 'yes'].includes(String(process.env.DISABLE_OUTBOUND_EMAIL || '').toLowerCase())
  );
  if (!dryRun && !outboundBlocked && !forcedDomain) {
    console.error('✋ Outbound email is ENABLED and these addresses use real');
    console.error('   consumer domains (gmail.com / yahoo.com).');
    console.error('   Set OUTBOUND_EMAIL=off in server/.env, or pass');
    console.error('   --email-domain <a-domain-you-control> to pin them.');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const conn = await mongoose.createConnection(uri).asPromise();
  const dbName = conn.db.databaseName;
  if (!/_seed$/.test(dbName)) {
    console.error(`✋ Refusing to modify "${dbName}" — name must end in "_seed".`);
    await conn.close();
    process.exit(1);
  }

  const users = conn.db.collection('users');
  const orders = conn.db.collection('orders');

  // Never rewrite non-customers (e.g. the seed admin). Only their emails seed
  // the used-address set so new customer addresses cannot collide.
  const customers = await users
    .find({ role: 'customer' })
    .sort({ createdAt: 1 })
    .toArray();
  const occupied = new Set(
    (await users.find({ role: { $ne: 'customer' } }).project({ email: 1 }).toArray())
      .map((u) => u.email.toLowerCase()),
  );

  console.log(`▶ Renormalising customer names in "${dbName}"`);
  console.log(`   customers : ${customers.length}`);
  console.log(`   dry run   : ${dryRun ? 'yes' : 'no'}`);
  console.log('');

  const usedFullNames = new Set();
  const usedEmails = new Set(occupied);
  const assigned = [];
  const skipped = [];

  // Ethnic-group lookup so an already-correct name can be kept rather than
  // needlessly reassigned — re-running this script should be a no-op on names.
  const groupIndex = {};
  for (const [g, pool] of Object.entries(ETHNIC_GROUPS)) {
    for (const n of pool.first) (groupIndex[`f:${n.toLowerCase()}`] ||= new Set()).add(g);
    for (const n of pool.last)  (groupIndex[`l:${n.toLowerCase()}`] ||= new Set()).add(g);
  }
  const coherentGroup = (fn, ln) => {
    const F = groupIndex[`f:${String(fn).toLowerCase()}`];
    const L = groupIndex[`l:${String(ln).toLowerCase()}`];
    if (!F || !L) return null;
    return [...F].find((g) => L.has(g)) || null;
  };

  for (const u of customers) {
    // Keep a name that is already a coherent, unused pair; only redraw when it
    // is cross-ethnic, unrecognised, or a duplicate.
    const existing = coherentGroup(u.firstName, u.lastName);
    const existingFull = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    let firstName; let lastName; let ethnicity;
    if (existing && !usedFullNames.has(existingFull)) {
      firstName = u.firstName;
      lastName = u.lastName;
      ethnicity = existing;
      usedFullNames.add(existingFull);
    } else {
      ({ firstName, lastName, ethnicity } = allocateCustomerName(usedFullNames));
    }
    const fullName = `${firstName} ${lastName}`;

    // Consumer-shaped address: mixed local-part styles (dotted, dotless,
    // underscored, initials, trailing digits) across a gmail/yahoo mix, so the
    // dataset does not read as 400 rows of `first.last@`.
    //
    // ⚠️  These can collide with real inboxes — see the OUTBOUND_EMAIL note at
    // the top of this file.
    const { email } = generateConsumerEmail(firstName, lastName, {
      used: usedEmails,
      domain: forcedDomain,
    });

    const beforeName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const beforeEmail = u.email || '';
    assigned.push({
      _id: u._id, beforeName, beforeEmail, fullName, email, ethnicity,
      nameKept: fullName === beforeName,
    });

    if (dryRun) continue;

    await users.updateOne({ _id: u._id }, {
      $set: { firstName, lastName, displayName: fullName, email },
    });
    const res = await orders.updateMany({ user: u._id }, {
      $set: {
        'shippingAddress.fullName': fullName,
        'shippingAddress.email': email,
      },
    });
    if (res.modifiedCount) {
      assigned[assigned.length - 1].ordersUpdated = res.modifiedCount;
    }
  }

  if (dryRun) {
    console.log('   (dry run — nothing written)\n');
    const byEthnicity = {};
    for (const a of assigned) byEthnicity[a.ethnicity] = (byEthnicity[a.ethnicity] || 0) + 1;
    console.log(`   would assign ${assigned.length} identities`);
    console.log(`   ethnic mix : ${JSON.stringify(byEthnicity)}`);
    console.log('');
    for (const a of assigned.slice(0, 10)) {
      console.log(`   ${a.beforeName.padEnd(28)} ${a.beforeEmail.padEnd(35)} → ${a.fullName.padEnd(28)} ${a.email}`);
    }
    await conn.close();
    return;
  }

  const byEthnicity = {};
  let ordersUpdated = 0;
  for (const a of assigned) {
    byEthnicity[a.ethnicity] = (byEthnicity[a.ethnicity] || 0) + 1;
    ordersUpdated += a.ordersUpdated || 0;
  }

  const kept = assigned.filter((a) => a.nameKept).length;
  console.log(`   ✓ users processed    : ${assigned.length}`);
  console.log(`     names kept         : ${kept} (already coherent)`);
  console.log(`     names redrawn      : ${assigned.length - kept}`);
  console.log(`   ✓ emails rewritten   : ${assigned.filter((a) => a.email !== a.beforeEmail).length}`);
  console.log(`   ✓ orders updated     : ${ordersUpdated}`);
  console.log(`   ✓ ethnic mix         : ${JSON.stringify(byEthnicity)}`);
  const domains = {};
  for (const a of assigned) { const d = a.email.split('@')[1]; domains[d] = (domains[d] || 0) + 1; }
  console.log(`   ✓ domains            : ${JSON.stringify(domains)}`);
  console.log('   (every account keeps its password)');

  const samples = assigned.slice(0, 8);
  console.log('\n   sample rewrites:');
  for (const a of samples) {
    console.log(`     ${a.beforeName.padEnd(26)} ${a.beforeEmail.padEnd(34)} → ${a.fullName.padEnd(26)} ${a.email}`);
  }
  console.log(`     … +${Math.max(0, assigned.length - samples.length)} more`);

  console.log(`\n   pool size check (igbo ${ETHNIC_GROUPS.igbo.first.length}×${ETHNIC_GROUPS.igbo.last.length}, ` +
              `hausa ${ETHNIC_GROUPS.hausa.first.length}×${ETHNIC_GROUPS.hausa.last.length}, ` +
              `yoruba ${ETHNIC_GROUPS.yoruba.first.length}×${ETHNIC_GROUPS.yoruba.last.length})`);

  await conn.close();
}

main().catch((err) => {
  console.error('💥', err.message);
  process.exit(1);
});