/**
 * Backfill `Appraisal.department` on records launched before department scoping.
 *
 * `department` is a SNAPSHOT taken at launch (see models/Appraisal.js). Every
 * appraisal created before the department phase shipped has none, and a
 * null-department record is deliberately invisible to a `tenant_admin`:
 * departmentFilter/departmentMatch in services/appraisalScope.service.js
 * exclude it, and resolveAppraisalAccess's HR branch does not cover it. That is
 * the right call for a record whose department genuinely cannot be established
 * — an unscoped record belongs to the owner alone — but it means every cycle
 * run before the cutover is invisible to the department managers who ran it.
 *
 * This fills the gap from the ONE source of truth available after the fact: the
 * employee's current `employeeProfile.work.department`. That is a reconstruction,
 * not the snapshot that was never taken — an employee who has transferred since
 * their appraisal will have it filed under their CURRENT department. Stated
 * plainly rather than papered over: for a historical record with no department
 * at all, "the department they are in now" is strictly better than "nobody may
 * look at this", and there is no other record of where they sat at the time.
 *
 * Never overwrites: an appraisal that already carries a department is left
 * exactly as launched, so re-running this is safe and it can never rewrite a
 * real snapshot with a stale profile lookup.
 *
 * Usage:
 *   node scripts/backfill-appraisal-departments.js            # dry run
 *   node scripts/backfill-appraisal-departments.js --apply    # write
 *   node scripts/backfill-appraisal-departments.js --tenant=<id> [--apply]
 *
 * Writes nothing without --apply.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const Department = require('../models/Department');
const User = require('../models/User');

const APPLY = process.argv.includes('--apply');
const TENANT = (process.argv.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || null;

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  // `{$in: [null, undefined]}` and not `{$exists: false}`: a record can carry
  // an explicit null as well as no key at all, and only the first form matches
  // both.
  const filter = { department: { $in: [null, undefined] } };
  if (TENANT) filter.tenant = new mongoose.Types.ObjectId(TENANT);

  const rows = await Appraisal.find(filter).select('_id tenant cycle employee').lean();
  console.log(`${rows.length} appraisal(s) with no department${TENANT ? ` in tenant ${TENANT}` : ''}`);
  if (!rows.length) return;

  // Three reads for the whole run, not one per appraisal.
  const employees = await User.find({ _id: { $in: rows.map((r) => r.employee) } })
    .select('_id firstName lastName status employeeProfile.work.department')
    .lean();
  const employeeById = new Map(employees.map((u) => [String(u._id), u]));
  const departments = await Department.find({}).select('_id name tenant').lean();
  const departmentById = new Map(departments.map((d) => [String(d._id), d]));
  const cycles = await AppraisalCycle.find({ _id: { $in: rows.map((r) => r.cycle) } })
    .select('_id name').lean();
  const cycleById = new Map(cycles.map((c) => [String(c._id), c]));

  const planned = [];
  const unresolved = [];
  for (const row of rows) {
    const employee = employeeById.get(String(row.employee));
    const departmentId = employee?.employeeProfile?.work?.department;
    const department = departmentId ? departmentById.get(String(departmentId)) : null;

    // A department from ANOTHER tenant would be a cross-tenant write, so it is
    // treated as unresolved rather than trusted. Nothing should be able to
    // produce one; the check costs one comparison and this script writes to
    // every tenant at once.
    if (!department || String(department.tenant) !== String(row.tenant)) {
      unresolved.push({ row, employee, reason: department ? 'cross_tenant' : 'no_department' });
      continue;
    }
    planned.push({ row, employee, department });
  }

  for (const { row, employee, department } of planned) {
    const who = employee ? `${employee.firstName} ${employee.lastName}`.trim() : String(row.employee);
    console.log(`  ${cycleById.get(String(row.cycle))?.name || row.cycle} | ${who} → ${department.name}`);
  }
  if (unresolved.length) {
    console.log(`\n${unresolved.length} left with no department (owner-visible only):`);
    for (const { row, employee, reason } of unresolved) {
      const who = employee
        ? `${employee.firstName} ${employee.lastName}`.trim() + (employee.status === 'deleted' ? ' [deleted]' : '')
        : `missing user ${row.employee}`;
      console.log(`  ${cycleById.get(String(row.cycle))?.name || row.cycle} | ${who} (${reason})`);
    }
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — would set a department on ${planned.length} appraisal(s). Re-run with --apply.`);
    return;
  }

  // bulkWrite rather than a loop of saves: these are single-field sets with no
  // hooks or validation to run, and the whole point is that a half-finished run
  // is re-runnable — the filter above simply no longer matches what was done.
  const result = await Appraisal.bulkWrite(
    planned.map(({ row, department }) => ({
      updateOne: {
        filter: { _id: row._id, tenant: row.tenant, department: { $in: [null, undefined] } },
        update: { $set: { department: department._id } },
      },
    }))
  );
  console.log(`\nApplied. matched=${result.matchedCount} modified=${result.modifiedCount}`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
