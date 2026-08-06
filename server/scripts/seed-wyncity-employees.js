/**
 * Import employees from the Wyncity Odoo export (Employee (hr.employee).xlsx)
 * into the wyncity tenant.
 *
 * - All employees are created as tenant_staff.
 * - Email is generated from the name: first.last@wyncity.test (lowercased).
 * - Manager is resolved by name match within the same batch.
 * - Self-managers (Chinaza, Jordan Ogene) have manager set to null.
 * - Idempotent: re-running updates existing users and re-applies manager refs.
 *
 * Usage: node scripts/seed-wyncity-employees.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';
const TENANT_SLUG = 'wyncity';
const PASSWORD = 'Wyncity#Employee2026';

// ── Parsed from: Employee (hr.employee).xlsx ──────────────────────────────
// Columns: Employee Name | Work Phone | Department | Job | Manager
const ROWS = [
  { name: 'Alice',                          phone: '08181000035', dept: 'Attendant',    job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Chibuike',                       phone: '',            dept: 'Driver',        job: 'Operations',          mgr: 'Chinaza' },
  { name: 'Chinaza',                        phone: '',            dept: '',              job: 'HR Manager',          mgr: 'Chinaza' },
  { name: 'Chisom Okpala',                  phone: '',            dept: '',              job: 'Warehouse Manager',   mgr: 'Chinaza' },
  { name: 'Cynthia',                        phone: '08181000035', dept: 'accounts',      job: '',                    mgr: '' },
  { name: 'Cynthia Abarakwe',               phone: '',            dept: 'Cashier',       job: 'Operations',          mgr: '' },
  { name: 'Emmanuel Attah',                 phone: '07064744119', dept: 'Attendant',     job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Esther Imoh',                    phone: '',            dept: 'Cashier',       job: 'Operations',          mgr: 'Chinaza' },
  { name: 'Faith',                          phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: '' },
  { name: 'Friday Zitta',                   phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: '' },
  { name: 'Gift',                           phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Goodness',                       phone: '',            dept: 'Sales',         job: 'Marketing',           mgr: 'OKPALA CHUKWUMA ANDREAS' },
  { name: 'Janice',                         phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Jennifer',                       phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Jordan Ogene',                   phone: '',            dept: 'Administration', job: '',                   mgr: 'Jordan Ogene' },
  { name: 'Mark',                           phone: '',            dept: 'Utility',       job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Mercy',                          phone: '',            dept: 'Management',    job: 'Digital Marketing',   mgr: 'OKPALA CHUKWUMA ANDREAS' },
  { name: 'Monday',                         phone: '',            dept: 'Driver',        job: 'Operations',          mgr: '' },
  { name: 'Nico',                           phone: '',            dept: 'Utility',       job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'OKPALA CHUKWUMA ANDREAS',        phone: '',            dept: 'Administration', job: '',                   mgr: '' },
  { name: 'Ochanya',                        phone: '',            dept: 'Sales',         job: 'Marketing',           mgr: 'OKPALA CHUKWUMA ANDREAS' },
  { name: 'Olisa',                          phone: '',            dept: 'Management',    job: 'IT',                  mgr: 'Chinaza' },
  { name: 'Oluchi',                         phone: '',            dept: 'Administration', job: 'Marketing',          mgr: 'Chinaza' },
  { name: 'PROGRESS',                       phone: '08181000035', dept: 'Cashier',       job: 'Operations',          mgr: 'Chinaza' },
  { name: 'Peace',                          phone: '',            dept: 'Office Assistant', job: 'Adminstrative',    mgr: 'Chinaza' },
  { name: 'Rejoice',                        phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: '' },
  { name: 'Salome',                         phone: '',            dept: 'Attendant',     job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Tony',                           phone: '',            dept: 'Utility',       job: 'Guest Services',      mgr: 'Chinaza' },
  { name: 'Victor',                         phone: '',            dept: 'Management',    job: 'Graphics',            mgr: 'OKPALA CHUKWUMA ANDREAS' },
  { name: 'Victoria',                       phone: '',            dept: 'Office Assistant', job: 'Adminstrative',    mgr: 'OKPALA CHUKWUMA ANDREAS' },
];

// ── Helpers ───────────────────────────────────────────────────────────────

/** 'Alice Johnson' → { firstName: 'Alice', lastName: 'Johnson' } */
function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: (parts[0] || '').replace(/./, c => c.toUpperCase()),
    lastName: parts.slice(1).join(' '),
  };
}

/** 'Alice Johnson' → 'alice.johnson@wyncity.test' */
function generateEmail(fullName) {
  return (
    fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '.')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '') + '@wyncity.test'
  );
}

/** Title-case a string: 'OKPALA CHUKWUMA ANDREAS' → 'Okpala Chukwuma Andreas' */
function titleCase(s) {
  return s
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const tenants = db.collection('tenants');
  const users = db.collection('users');

  // Find tenant
  const tenant =
    (await tenants.findOne({ slug: TENANT_SLUG })) ||
    (await tenants.findOne({ name: new RegExp(`^${TENANT_SLUG}$`, 'i') })) ||
    (await tenants.findOne({ name: /wyn\s*city/i }));

  if (!tenant) {
    console.error(`Tenant "${TENANT_SLUG}" not found`);
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.name} (${tenant._id})`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Pass 1: Create all users (no manager refs yet) ──────────────────────
  // email → _id map, keyed by lowercased full name from the Excel
  const nameToId = {};
  let created = 0;
  let updated = 0;

  for (const row of ROWS) {
    const email = generateEmail(row.name);
    const { firstName, lastName } = splitName(row.name);

    const set = {
      email,
      firstName,
      lastName,
      displayName: titleCase(row.name),
      role: 'tenant_staff',
      status: 'active',
      tenant: tenant._id,
      passwordHash,
      isEmailVerified: true,
      'employeeProfile.work.department': row.dept || '',
      'employeeProfile.work.jobTitle': row.job || '',
      'employeeProfile.work.manager': null,  // resolved in pass 2
    };
    if (row.phone) {
      set.phone = row.phone;
      set['employeeProfile.privateContact.phone'] = row.phone;
    }

    const res = await users.findOneAndUpdate(
      { email },
      { $set: set, $setOnInsert: { createdAt: new Date() }, $currentDate: { updatedAt: true } },
      { upsert: true, returnDocument: 'after' }
    );

    const doc = res.value || res;
    nameToId[row.name.toUpperCase()] = doc._id;

    // Track insert vs update
    const existing = await users.findOne({ email }, { _id: 1 });
    created += res.lastErrorObject?.upserted ? 1 : 0;
    updated += !res.lastErrorObject?.upserted ? 1 : 0;

    console.log(`  ✓ ${row.name.padEnd(28)} ${email.padEnd(38)} _id=${doc._id}`);
  }

  // ── Pass 2: Resolve manager refs ────────────────────────────────────────
  let mgrSet = 0;
  let mgrSkipped = 0;

  for (const row of ROWS) {
    if (!row.mgr) continue;

    const empEmail = generateEmail(row.name);
    const mgrId = nameToId[row.mgr.toUpperCase()];
    if (!mgrId) {
      console.log(`  ⚠ Manager "${row.mgr}" not found for ${row.name} — skipped`);
      mgrSkipped++;
      continue;
    }

    // Self-manager → set to null (would be skipped by appraisal launch)
    if (row.name.toUpperCase() === row.mgr.toUpperCase()) {
      await users.updateOne({ email: empEmail }, { $set: { 'employeeProfile.work.manager': null } });
      console.log(`  ⚠ ${row.name}: self-manager → manager set to null (appraisal will skip)`);
      continue;
    }

    await users.updateOne({ email: empEmail }, { $set: { 'employeeProfile.work.manager': mgrId } });
    console.log(`  → ${row.name.padEnd(28)} manager: ${row.mgr} (${mgrId})`);
    mgrSet++;
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const total = await users.countDocuments({ tenant: tenant._id, role: { $in: ['tenant_owner', 'tenant_admin', 'tenant_staff'] } });
  console.log(`\nDone.`);
  console.log(`  Upserted: ${ROWS.length} rows (${created} created, ${updated} updated)`);
  console.log(`  Manager refs set: ${mgrSet}, self-managed/skipped: ${mgrSkipped}`);
  console.log(`  Total tenant staff now: ${total}`);
  console.log(`\n  Password for ALL new employees: ${PASSWORD}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
