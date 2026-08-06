/**
 * Seed disposable test users for the appraisal module (Phase 1 Task 11;
 * extended in Phase 2 Task 16 with three peer-reviewer accounts).
 *
 * Creates seven users under the wyncity tenant so the full appraisal loop
 * (including peer review) can be driven over HTTP:
 *   - HR          (tenant_admin) — creates/launches cycles
 *   - Manager     (tenant_staff) — summarises + releases
 *   - Employee    (tenant_staff) — subject of the appraisal under test
 *   - Unrelated   (tenant_staff) — third party, used to prove 403 isolation
 *   - Peer1/2/3   (tenant_staff) — eligible peer reviewers nominated by
 *     Employee; approved/rejected/added by Manager; one submits, one
 *     declines and is backfilled by Peer3
 *
 * Employee, Unrelated and the three peers all report to Manager so all are
 * enrolled by launchCycle when scoped by employeeIds; Unrelated and the
 * peers are never the subject of the appraisal under test.
 *
 * Idempotent: re-running updates the same seven accounts in place and resets
 * their password back to the printed value.
 *
 * Usage: node scripts/seed-appraisal-test-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

const TENANT_SLUG = 'wyncity';
const PASSWORD = 'Appraisal#Test2026';

// Ordered: managers must exist before their reports so we can resolve the id.
const USERS = [
  {
    key: 'hr',
    email: 'appraisal-hr@wyncity.test',
    firstName: 'Hana',
    lastName: 'Resources',
    role: 'tenant_admin',
    jobTitle: 'HR Manager',
    managerKey: null,
  },
  {
    key: 'manager',
    email: 'appraisal-manager@wyncity.test',
    firstName: 'Mani',
    lastName: 'Lead',
    role: 'tenant_staff',
    jobTitle: 'Floor Supervisor',
    managerKey: null,
  },
  {
    key: 'employee',
    email: 'appraisal-employee@wyncity.test',
    firstName: 'Emeka',
    lastName: 'Staff',
    role: 'tenant_staff',
    jobTitle: 'Sales Associate',
    managerKey: 'manager',
  },
  {
    key: 'unrelated',
    email: 'appraisal-unrelated@wyncity.test',
    firstName: 'Uche',
    lastName: 'Bystander',
    role: 'tenant_staff',
    jobTitle: 'Stock Assistant',
    managerKey: 'manager',
  },
  {
    key: 'peer1',
    email: 'appraisal-peer1@wyncity.test',
    firstName: 'Peju',
    lastName: 'Reviewer',
    role: 'tenant_staff',
    jobTitle: 'Sales Associate',
    managerKey: 'manager',
  },
  {
    key: 'peer2',
    email: 'appraisal-peer2@wyncity.test',
    firstName: 'Pius',
    lastName: 'Reviewer',
    role: 'tenant_staff',
    jobTitle: 'Sales Associate',
    managerKey: 'manager',
  },
  {
    key: 'peer3',
    email: 'appraisal-peer3@wyncity.test',
    firstName: 'Patience',
    lastName: 'Reviewer',
    role: 'tenant_staff',
    jobTitle: 'Sales Associate',
    managerKey: 'manager',
  },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const tenants = db.collection('tenants');
  const users = db.collection('users');

  // Look up by slug, falling back to a case-insensitive name match rather than
  // hardcoding an ObjectId.
  const tenant =
    (await tenants.findOne({ slug: TENANT_SLUG })) ||
    (await tenants.findOne({ name: new RegExp(`^${TENANT_SLUG}$`, 'i') })) ||
    (await tenants.findOne({ name: /wyn\s*city/i }));

  if (!tenant) {
    console.error(`Tenant not found for slug/name "${TENANT_SLUG}"`);
    process.exit(1);
  }
  console.log(`Found tenant: ${tenant.name} (${tenant._id})`);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const idsByKey = {};

  for (const u of USERS) {
    const manager = u.managerKey ? idsByKey[u.managerKey] : null;
    if (u.managerKey && !manager) {
      throw new Error(`Manager "${u.managerKey}" was not seeded before "${u.key}"`);
    }

    // Dotted paths only: a nested object under $set would REPLACE the whole
    // employeeProfile subdocument and shred any unrelated fields.
    const set = {
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      displayName: `${u.firstName} ${u.lastName}`,
      role: u.role,
      status: 'active',
      tenant: tenant._id,
      passwordHash,
      isEmailVerified: true,
      'employeeProfile.work.jobTitle': u.jobTitle,
      'employeeProfile.work.department': 'Retail',
    };

    if (manager) {
      set['employeeProfile.work.manager'] = manager;
    } else {
      // HR and Manager have no reporting line; clear any stale value so the
      // script is genuinely idempotent across edits.
      set['employeeProfile.work.manager'] = null;
    }

    const res = await users.findOneAndUpdate(
      { email: u.email },
      { $set: set, $setOnInsert: { createdAt: new Date() }, $currentDate: { updatedAt: true } },
      { upsert: true, returnDocument: 'after' }
    );

    const doc = res.value || res;
    idsByKey[u.key] = doc._id;
    console.log(
      `  ${u.key.padEnd(9)} ${u.email.padEnd(36)} ${u.role.padEnd(13)} _id=${doc._id}` +
        (manager ? ` manager=${manager}` : '')
    );
  }

  console.log(`\nSeeded ${USERS.length} appraisal test users under tenant`, tenant.name);
  console.log(`Password for ALL ${USERS.length} accounts:`, PASSWORD);
  console.log('\nIds:');
  for (const [k, v] of Object.entries(idsByKey)) console.log(`  ${k}: ${v}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
