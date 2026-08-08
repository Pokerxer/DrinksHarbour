/**
 * Migrate free-text employee org data into real entities.
 *
 * WHY
 * ---
 * `employeeProfile.work.department`, `.jobPosition`, `planning.roles[]`,
 * `planning.defaultRole` and `approvers.*` used to be strings. Nothing could be
 * listed, counted, staffed or routed to. They are now refs — Department,
 * JobPosition, EmployeeRole and User respectively — and this script is what
 * turns the existing strings into those records.
 *
 * WHAT IT DOES, per tenant
 * ------------------------
 *   1. Collects the distinct non-empty values of each string field, folding case
 *      and collapsing whitespace (orgNameKey), so "Sales", "sales" and
 *      "Sales " converge on one department rather than three.
 *   2. Creates the missing Department / JobPosition / EmployeeRole records,
 *      reusing any that already exist under the same normalised name.
 *   3. PRESERVES the old jobPosition string into `work.jobTitle` when jobTitle is
 *      empty. The position becomes a shared entity; the title is this person's
 *      own wording for it, and dropping the string would lose that wording for
 *      good.
 *   4. Re-points every employee at the new ids.
 *   5. Resolves `approvers.*` names to real users by exact email, then by exact
 *      full name. Ambiguous or unmatched names are REPORTED, never guessed —
 *      routing an approval to the wrong person is worse than not routing it.
 *
 * A job position's department is inferred from the employees who hold it: if
 * every holder sits in one department, the position is filed there; if they are
 * split across departments, it is left department-less and reported, because
 * picking one arbitrarily would silently misfile the others.
 *
 * DEPARTMENT VALUES THAT ARE NOT DEPARTMENTS
 * ------------------------------------------
 * The department box was free text, so people typed what they DO into it.
 * Wyn City's data holds Attendant, Driver, Cashier and Office Assistant
 * alongside genuine units (Retail, Sales, Administration, …). Migrating those
 * four as Departments would bake the confusion into real records that then
 * cannot be deleted while staff point at them.
 *
 * So they are reclassified: an EmployeeRole is created instead, the employee is
 * given that planning role, and their `work.department` is CLEARED rather than
 * left as free text — a legacy string sitting in a ref field throws a CastError
 * on the employee's next profile save.
 *
 * The list is data, not a guess baked into the code path: override it with
 * `--dept-is-role="A,B,C"`, or pass `--dept-is-role=` to reclassify nothing.
 *
 * SAFETY
 * ------
 * Dry-run by default — it reads, reports exactly what it would do, and writes
 * nothing. Pass --apply to commit. Re-running after --apply is a no-op for rows
 * already migrated, because a ref value fails the "is this free text?" test.
 *
 * USAGE
 *   node -r dotenv/config scripts/migrate-employee-org-structure.js
 *   node -r dotenv/config scripts/migrate-employee-org-structure.js --apply
 *   node -r dotenv/config scripts/migrate-employee-org-structure.js --apply --tenant=<tenantId>
 *   node -r dotenv/config scripts/migrate-employee-org-structure.js --dept-is-role="Driver,Cashier"
 */

const mongoose = require('mongoose');

const User = require('../models/User');
const Department = require('../models/Department');
const JobPosition = require('../models/JobPosition');
const EmployeeRole = require('../models/EmployeeRole');
const { orgNameKey, buildNameIndex } = require('../services/orgStructure.helpers');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drinksharbour';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const TENANT_ARG = (argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || null;

const EMPLOYEE_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

// Free-text department values that are really what someone DOES, observed in
// Wyn City's data on 2026-08-08. Override with --dept-is-role="A,B,C".
const DEFAULT_DEPT_VALUES_THAT_ARE_ROLES = ['Attendant', 'Driver', 'Cashier', 'Office Assistant'];

const DEPT_IS_ROLE_FLAG = '--dept-is-role=';
const deptIsRoleArg = argv.find((a) => a.startsWith(DEPT_IS_ROLE_FLAG));
// An ABSENT flag means "use the defaults"; a PRESENT but empty one means
// "reclassify nothing". `arg || default` would collapse the two.
const RECLASSIFIED_DEPT_KEYS = new Set(
  (deptIsRoleArg === undefined
    ? DEFAULT_DEPT_VALUES_THAT_ARE_ROLES
    : deptIsRoleArg.slice(DEPT_IS_ROLE_FLAG.length).split(',')
  )
    .map(orgNameKey)
    .filter(Boolean)
);

/** Is this free-text department value actually a planning role? */
function isReclassifiedDepartment(value) {
  return RECLASSIFIED_DEPT_KEYS.has(orgNameKey(value));
}

const idKey = (v) => (v && v._id ? String(v._id) : String(v));

/**
 * A value still needs migrating only if it is a non-empty string that is NOT
 * already an id. This is what makes the script idempotent: after --apply the
 * stored values are ObjectIds and every one of them fails this test.
 */
function isLegacyString(v) {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return s !== '' && !OBJECT_ID_RE.test(s);
}

/**
 * An empty string left in a ref field.
 *
 * It is not a legacy VALUE — there is nothing to migrate — but it is still free
 * text in an ObjectId path, and `''` is a hard CastError there ("Cast to
 * ObjectId failed ... because of BSONError"), not a null-like Mongoose forgives.
 * Left alone it breaks the employee's next profile save, so it is nulled out.
 */
function isEmptyRefString(v) {
  return typeof v === 'string' && v.trim() === '';
}

/** Every employeeProfile path that is now an ObjectId ref. */
const REF_PATHS = [
  ['work', 'department'],
  ['work', 'jobPosition'],
  ['planning', 'defaultRole'],
  ['approvers', 'hrResponsible'],
  ['approvers', 'expense'],
  ['approvers', 'timeOff'],
];

/** Display name for a legacy value: trimmed, interior whitespace collapsed. */
function displayName(v) {
  return String(v).trim().replace(/\s+/g, ' ');
}

/**
 * Resolve or create records for a set of legacy names.
 * @returns {Promise<{index: Map<string, object>, created: string[]}>}
 */
async function ensureEntities(Model, tenantId, names, extraFields = {}) {
  const existing = await Model.find({ tenant: tenantId }).select('_id name').lean();
  const index = buildNameIndex(existing);
  const created = [];

  for (const name of names) {
    const key = orgNameKey(name);
    if (!key || index.has(key)) continue;

    if (APPLY) {
      const doc = await Model.create({ tenant: tenantId, name: displayName(name), ...extraFields });
      index.set(key, { _id: doc._id, name: doc.name });
    } else {
      // Placeholder id so the dry run can still report the re-point counts.
      index.set(key, { _id: `<new:${displayName(name)}>`, name: displayName(name) });
    }
    created.push(displayName(name));
  }

  return { index, created };
}

/** Build a lookup of tenant users by lowercased email and by lowercased full name. */
function buildUserLookup(users) {
  const byEmail = new Map();
  const byName = new Map();
  const ambiguousNames = new Set();

  for (const u of users) {
    if (u.email) byEmail.set(String(u.email).toLowerCase().trim(), u);
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim().toLowerCase();
    if (!full) continue;
    // A name shared by two people cannot be resolved safely; remember that and
    // refuse rather than picking the first match.
    if (byName.has(full)) ambiguousNames.add(full);
    else byName.set(full, u);
  }

  return { byEmail, byName, ambiguousNames };
}

function resolveApprover(value, lookup) {
  const s = displayName(value).toLowerCase();
  if (!s) return { ok: false, reason: 'empty' };
  const byEmail = lookup.byEmail.get(s);
  if (byEmail) return { ok: true, user: byEmail };
  if (lookup.ambiguousNames.has(s)) return { ok: false, reason: 'ambiguous' };
  const byName = lookup.byName.get(s);
  if (byName) return { ok: true, user: byName };
  return { ok: false, reason: 'unmatched' };
}

async function migrateTenant(tenantId, report) {
  const employees = await User.find({
    tenant: tenantId,
    role: { $in: EMPLOYEE_ROLES },
    status: { $ne: 'deleted' },
  })
    .select('firstName lastName email employeeProfile')
    .lean();

  if (!employees.length) return;

  // ── 1. Collect distinct legacy values ─────────────────────────────────────
  const deptNames = new Set();
  const positionNames = new Set();
  const roleNames = new Set();

  for (const e of employees) {
    const w = e.employeeProfile?.work || {};
    const pl = e.employeeProfile?.planning || {};
    if (isLegacyString(w.department)) {
      // A misfiled value becomes a capability, not a unit.
      const target = isReclassifiedDepartment(w.department) ? roleNames : deptNames;
      target.add(displayName(w.department));
    }
    if (isLegacyString(w.jobPosition)) positionNames.add(displayName(w.jobPosition));
    if (isLegacyString(pl.defaultRole)) roleNames.add(displayName(pl.defaultRole));
    for (const r of Array.isArray(pl.roles) ? pl.roles : []) {
      if (isLegacyString(r)) roleNames.add(displayName(r));
    }
  }

  // ── 2. Create the entities ────────────────────────────────────────────────
  const departments = await ensureEntities(Department, tenantId, deptNames);
  const roles = await ensureEntities(EmployeeRole, tenantId, roleNames);

  // A position's department is inferred from its holders — but only when they
  // agree. Split holders leave it unfiled rather than misfiled.
  const positionDepartments = new Map(); // positionKey → Set of department keys
  for (const e of employees) {
    const w = e.employeeProfile?.work || {};
    if (!isLegacyString(w.jobPosition)) continue;
    const pKey = orgNameKey(w.jobPosition);
    if (!positionDepartments.has(pKey)) positionDepartments.set(pKey, new Set());
    // A reclassified value is not a department, so it must not vote on where a
    // position is filed — nor make holders look "split" and leave it unfiled.
    if (isLegacyString(w.department) && !isReclassifiedDepartment(w.department)) {
      positionDepartments.get(pKey).add(orgNameKey(w.department));
    }
  }

  const existingPositions = await JobPosition.find({ tenant: tenantId }).select('_id name').lean();
  const positionIndex = buildNameIndex(existingPositions);
  const createdPositions = [];

  for (const name of positionNames) {
    const key = orgNameKey(name);
    if (!key || positionIndex.has(key)) continue;

    const deptKeys = [...(positionDepartments.get(key) || [])];
    let department = null;
    if (deptKeys.length === 1) {
      department = departments.index.get(deptKeys[0])?._id ?? null;
    } else if (deptKeys.length > 1) {
      report.splitPositions.push(`${displayName(name)} (held across ${deptKeys.length} departments)`);
    }

    if (APPLY) {
      const doc = await JobPosition.create({
        tenant: tenantId,
        name: displayName(name),
        // A placeholder id from a dry run must never reach the database.
        department: typeof department === 'string' ? null : department,
      });
      positionIndex.set(key, { _id: doc._id, name: doc.name });
    } else {
      positionIndex.set(key, { _id: `<new:${displayName(name)}>`, name: displayName(name) });
    }
    createdPositions.push(displayName(name));
  }

  // ── 3-5. Re-point employees ───────────────────────────────────────────────
  const lookup = buildUserLookup(employees);
  let repointed = 0;
  let titlesPreserved = 0;

  for (const e of employees) {
    const w = e.employeeProfile?.work || {};
    const pl = e.employeeProfile?.planning || {};
    const ap = e.employeeProfile?.approvers || {};
    const set = {};

    for (const [group, field] of REF_PATHS) {
      const current = e.employeeProfile?.[group]?.[field];
      if (isEmptyRefString(current)) {
        set[`employeeProfile.${group}.${field}`] = null;
        report.blankedRefs.push(`${e.email}: ${group}.${field} was an empty string`);
      }
    }

    // Roles this employee should end up holding: whatever they already hold as
    // a real ref, plus anything derived below. Collected before the department
    // is read, because a reclassified department contributes one.
    const roleIds = new Map(
      (Array.isArray(pl.roles) ? pl.roles : [])
        .filter((r) => !isLegacyString(r))
        .map((r) => [idKey(r), r])
    );
    let reclassifiedRoleId = null;

    if (isLegacyString(w.department)) {
      if (isReclassifiedDepartment(w.department)) {
        const hit = roles.index.get(orgNameKey(w.department));
        if (hit) {
          reclassifiedRoleId = hit._id;
          roleIds.set(idKey(hit._id), hit._id);
        }
        // Cleared, never left as the original string: free text in a ref field
        // throws a CastError on the employee's next profile save.
        set['employeeProfile.work.department'] = null;
        report.reclassified.push(`${e.email}: department "${displayName(w.department)}" → role`);
      } else {
        const hit = departments.index.get(orgNameKey(w.department));
        if (hit) set['employeeProfile.work.department'] = hit._id;
      }
    }

    if (isLegacyString(w.jobPosition)) {
      const hit = positionIndex.get(orgNameKey(w.jobPosition));
      if (hit) set['employeeProfile.work.jobPosition'] = hit._id;
      // Keep the wording before the string is gone.
      if (!String(w.jobTitle || '').trim()) {
        set['employeeProfile.work.jobTitle'] = displayName(w.jobPosition);
        titlesPreserved += 1;
      }
    }

    for (const r of (Array.isArray(pl.roles) ? pl.roles : []).filter(isLegacyString)) {
      const hit = roles.index.get(orgNameKey(r));
      if (hit) roleIds.set(idKey(hit._id), hit._id);
    }
    // Only written when it actually changes: an unconditional write would
    // rewrite an already-migrated list on every re-run.
    const before = (Array.isArray(pl.roles) ? pl.roles : []).map(idKey).join('|');
    if (roleIds.size && Array.from(roleIds.keys()).join('|') !== before) {
      set['employeeProfile.planning.roles'] = Array.from(roleIds.values());
    }

    if (isLegacyString(pl.defaultRole)) {
      const hit = roles.index.get(orgNameKey(pl.defaultRole));
      if (hit) set['employeeProfile.planning.defaultRole'] = hit._id;
    } else if (reclassifiedRoleId && !pl.defaultRole) {
      // The reclassified value was the only thing anyone recorded about what
      // this person does, so it is their default role too.
      set['employeeProfile.planning.defaultRole'] = reclassifiedRoleId;
    }

    for (const field of ['hrResponsible', 'expense', 'timeOff']) {
      if (!isLegacyString(ap[field])) continue;
      const res = resolveApprover(ap[field], lookup);
      if (res.ok) {
        set[`employeeProfile.approvers.${field}`] = res.user._id;
      } else {
        report.unresolvedApprovers.push(
          `${e.email}: approvers.${field} = "${displayName(ap[field])}" (${res.reason})`
        );
        // Clear it rather than leave free text in a ref field — an unmigrated
        // string there throws a CastError on the employee's next profile save.
        set[`employeeProfile.approvers.${field}`] = null;
      }
    }

    if (!Object.keys(set).length) continue;
    repointed += 1;

    if (APPLY) {
      // $set with dotted paths, deliberately: assigning the whole
      // employeeProfile subdocument would REPLACE it and drop every field this
      // script does not name.
      await User.updateOne({ _id: e._id }, { $set: set });
    }
  }

  report.tenants.push({
    tenant: String(tenantId),
    employees: employees.length,
    departmentsCreated: departments.created,
    positionsCreated: createdPositions,
    rolesCreated: roles.created,
    repointed,
    titlesPreserved,
  });
}

async function main() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 20000, family: 4 });
  console.log(`\n${APPLY ? '🔧 APPLY' : '🔍 DRY RUN'} — employee org structure migration\n`);

  const match = { role: { $in: EMPLOYEE_ROLES }, status: { $ne: 'deleted' }, tenant: { $ne: null } };
  if (TENANT_ARG) match.tenant = new mongoose.Types.ObjectId(TENANT_ARG);

  const tenantIds = await User.distinct('tenant', match);
  const report = {
    tenants: [],
    unresolvedApprovers: [],
    splitPositions: [],
    reclassified: [],
    blankedRefs: [],
  };

  if (RECLASSIFIED_DEPT_KEYS.size) {
    console.log(
      `Treating these department values as planning roles: ${Array.from(RECLASSIFIED_DEPT_KEYS).join(', ')}\n`
    );
  }

  for (const tenantId of tenantIds) {
    await migrateTenant(tenantId, report);
  }

  for (const t of report.tenants) {
    console.log(`Tenant ${t.tenant} — ${t.employees} employees`);
    console.log(`  departments created : ${t.departmentsCreated.length}${t.departmentsCreated.length ? ` (${t.departmentsCreated.join(', ')})` : ''}`);
    console.log(`  positions created   : ${t.positionsCreated.length}${t.positionsCreated.length ? ` (${t.positionsCreated.join(', ')})` : ''}`);
    console.log(`  roles created       : ${t.rolesCreated.length}${t.rolesCreated.length ? ` (${t.rolesCreated.join(', ')})` : ''}`);
    console.log(`  employees re-pointed: ${t.repointed}`);
    console.log(`  job titles preserved: ${t.titlesPreserved}\n`);
  }

  if (report.blankedRefs.length) {
    console.log('🧹 Empty strings cleared from ref fields (a CastError on the next save):');
    for (const line of report.blankedRefs) console.log(`   - ${line}`);
    console.log('');
  }

  if (report.reclassified.length) {
    console.log('↪️  Department values reclassified as planning roles (department cleared):');
    for (const line of report.reclassified) console.log(`   - ${line}`);
    console.log('');
  }

  if (report.splitPositions.length) {
    console.log('⚠️  Positions left department-less (holders span several departments):');
    for (const line of report.splitPositions) console.log(`   - ${line}`);
    console.log('');
  }

  if (report.unresolvedApprovers.length) {
    console.log('⚠️  Approvers that could not be resolved to an account (cleared, reassign in the UI):');
    for (const line of report.unresolvedApprovers) console.log(`   - ${line}`);
    console.log('');
  }

  if (!APPLY) console.log('Nothing was written. Re-run with --apply to commit.\n');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
