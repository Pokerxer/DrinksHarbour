/**
 * Read-only audit of every privileged account on the platform.
 *
 * Until the 2026-07-25 auth overhaul, two public endpoints could mint a
 * super_admin without any authentication:
 *
 *   POST /api/users/register        — role was taken from the request body
 *   POST /api/verification/verify-code — role was hard-coded to 'super_admin'
 *
 * Both are closed now, but any account created through them while they were
 * open still exists and still works. This script lists the privileged accounts
 * so a human can decide which are legitimate.
 *
 * It WRITES NOTHING. Deciding that an account is rogue needs knowledge of the
 * team that this codebase does not have, and automatically disabling a real
 * administrator would be worse than the exposure. Disposition is the
 * operator's call.
 *
 * Signals worth attention, flagged in the output:
 *   - createdBy absent          → self-registered rather than admin-created.
 *                                 Expected on accounts predating this change,
 *                                 so it is weak evidence on its own.
 *   - isEmailVerified false     → never proved control of the inbox.
 *   - lastLogin absent          → created but never used.
 *   - email domain not matching --expect-domain, when given.
 *
 * Usage:
 *   node scripts/audit-privileged-accounts.js [--expect-domain=drinksharbour.com] [--json]
 *
 * NOTE: run from a permitted host — Atlas blocks the local dev IP.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');

const PRIVILEGED_ROLES = ['super_admin', 'admin', 'tenant_admin', 'tenant_owner'];

const argOf = (name) =>
  (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || '';

const EXPECT_DOMAIN = argOf('expect-domain');
const AS_JSON = process.argv.includes('--json');

const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '—');

function flagsFor(user) {
  const flags = [];
  if (!user.createdBy) flags.push('self-registered');
  if (!user.isEmailVerified) flags.push('email-unverified');
  if (!user.lastLogin) flags.push('never-logged-in');
  if (EXPECT_DOMAIN && !String(user.email || '').endsWith(`@${EXPECT_DOMAIN}`)) {
    flags.push('off-domain');
  }
  return flags;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGODB_URI in environment. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const users = await User.find({ role: { $in: PRIVILEGED_ROLES } })
    .select('email role status createdAt lastLogin lastLoginIp isEmailVerified createdBy googleId tenant')
    .sort({ role: 1, createdAt: 1 })
    .lean();

  const rows = users.map((u) => ({
    email: u.email,
    role: u.role,
    status: u.status,
    created: fmtDate(u.createdAt),
    lastLogin: fmtDate(u.lastLogin),
    lastLoginIp: u.lastLoginIp || '—',
    emailVerified: !!u.isEmailVerified,
    createdBy: u.createdBy ? String(u.createdBy) : null,
    flags: flagsFor(u),
  }));

  if (AS_JSON) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(`\nPrivileged accounts: ${rows.length}\n`);
    for (const role of PRIVILEGED_ROLES) {
      const group = rows.filter((r) => r.role === role);
      if (!group.length) continue;
      console.log(`── ${role} (${group.length}) ${'─'.repeat(Math.max(0, 50 - role.length))}`);
      for (const r of group) {
        const flags = r.flags.length ? `  [${r.flags.join(', ')}]` : '';
        console.log(
          `  ${r.email.padEnd(38)} ${r.status.padEnd(10)} created ${r.created}  last-login ${r.lastLogin}${flags}`
        );
      }
      console.log('');
    }

    const suspect = rows.filter((r) => r.flags.length >= 2);
    if (suspect.length) {
      console.log(`${suspect.length} account(s) carry two or more flags and are worth a closer look:`);
      suspect.forEach((r) => console.log(`  ${r.email}  [${r.flags.join(', ')}]`));
      console.log('');
    }

    console.log('This script changed nothing. Review the list and act manually.\n');
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Audit failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
