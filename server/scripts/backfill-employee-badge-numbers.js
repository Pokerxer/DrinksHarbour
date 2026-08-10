/**
 * Issue a badge number to every employee who does not have one.
 *
 * The badge card carries a 1-D barcode so a cheap laser scanner can read it,
 * and what that barcode encodes is `employeeProfile.attendance.rfidBadge`. New
 * employees get a number on creation (employee.controller.js); everybody hired
 * before that shipped has an empty field, and their card falls back to the
 * 24-character ObjectId — which at CR80 card width prints a ~0.15mm bar, well
 * under the ~0.19mm the cheapest scanner can resolve. In other words their card
 * is not "tight", it is unreadable. This closes that gap.
 *
 * NEVER OVERWRITES. `rfidBadge` is free text on purpose: a business with
 * pre-printed cards puts its own numbering in it, and `STAFF-0042` is a
 * perfectly good badge that this script must leave exactly as it found it. Only
 * an empty field is filled, so a half-finished run is simply re-runnable.
 *
 * Uniqueness is per tenant and the compound partial index is the arbiter — the
 * numbers drawn here are also checked against the ones already issued in the
 * same tenant, so the common case never round-trips a rejected write.
 *
 * Usage:
 *   node scripts/backfill-employee-badge-numbers.js            # dry run
 *   node scripts/backfill-employee-badge-numbers.js --apply    # write
 *   node scripts/backfill-employee-badge-numbers.js --tenant=<id> [--apply]
 *
 * Writes nothing without --apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const User = require('../models/User');
const { EMPLOYEE_ROLES } = require('../services/employee.helpers');
const {
  BADGE_NUMBER_PATH,
  generateBadgeNumber,
  assignBadgeNumber,
  formatBadgeNumber,
} = require('../services/badgeNumber.helpers');

const APPLY = process.argv.includes('--apply');
const TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || '';

// "Has no badge" as stored, covering all three ways the field can be absent:
// never written, explicitly null, or an empty string left by an older client.
const MISSING = { $in: [null, undefined, ''] };

const name = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const scope = {
    role: { $in: EMPLOYEE_ROLES },
    status: { $ne: 'deleted' },
  };
  if (TENANT) scope.tenant = new mongoose.Types.ObjectId(TENANT);

  const employees = await User.find({ ...scope, [BADGE_NUMBER_PATH]: MISSING })
    .select(`_id tenant firstName lastName email ${BADGE_NUMBER_PATH}`)
    .lean();

  console.log(
    `${employees.length} employee(s) with no badge number${TENANT ? ` in tenant ${TENANT}` : ''}`
  );
  if (!employees.length) return;

  // Every number already in use, per tenant — including hand-entered ones, and
  // including employees whose account is deleted, because the card they were
  // issued may well still be in a drawer somewhere.
  const inUse = await User.find({ [BADGE_NUMBER_PATH]: { $nin: [null, undefined, ''] } })
    .select(`tenant ${BADGE_NUMBER_PATH}`)
    .lean();
  const takenByTenant = new Map();
  for (const u of inUse) {
    const key = String(u.tenant || '');
    if (!takenByTenant.has(key)) takenByTenant.set(key, new Set());
    takenByTenant.get(key).add(u.employeeProfile.attendance.rfidBadge);
  }

  if (!APPLY) {
    // Draw the numbers anyway so the dry run shows real, plausible output —
    // but nothing is written and nothing is reserved.
    for (const e of employees) {
      const taken = takenByTenant.get(String(e.tenant || '')) || new Set();
      let code = generateBadgeNumber();
      while (taken.has(code)) code = generateBadgeNumber();
      taken.add(code);
      takenByTenant.set(String(e.tenant || ''), taken);
      console.log(`  would issue ${formatBadgeNumber(code)}  ${name(e)}`);
    }
    console.log('\nDry run — nothing written. Re-run with --apply.');
    return;
  }

  // The per-tenant unique index is what makes any of this safe. Create it
  // before writing rather than trusting that a server has booted since the
  // schema changed. This only creates indexes the schema declares; it drops
  // nothing.
  await User.createIndexes();

  let issued = 0;
  for (const e of employees) {
    const tenantKey = String(e.tenant || '');
    if (!takenByTenant.has(tenantKey)) takenByTenant.set(tenantKey, new Set());
    const taken = takenByTenant.get(tenantKey);

    const generate = () => {
      let code = generateBadgeNumber();
      while (taken.has(code)) code = generateBadgeNumber();
      return code;
    };

    // The guard on the filter is what makes a re-run safe: if a number landed
    // between the read above and now, the update matches nothing rather than
    // overwriting it.
    // eslint-disable-next-line no-await-in-loop
    const code = await assignBadgeNumber(async (candidate) => {
      const result = await User.updateOne(
        { _id: e._id, [BADGE_NUMBER_PATH]: MISSING },
        { $set: { [BADGE_NUMBER_PATH]: candidate } }
      );
      return result.modifiedCount ? candidate : null;
    }, { generate });

    if (code) {
      taken.add(code);
      issued += 1;
      console.log(`  ${formatBadgeNumber(code)}  ${name(e)}`);
    } else {
      console.log(`  skipped (already has one)  ${name(e)}`);
    }
  }

  console.log(`\nApplied. issued=${issued} of ${employees.length}`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
