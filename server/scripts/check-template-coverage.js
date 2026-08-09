/**
 * Who would a review form actually ask something, and who would it miss?
 *
 * A section carrying a `departments` list reaches only that department, so a
 * form written department by department covers exactly the departments
 * somebody wrote a section for. An employee outside all of them gets an
 * appraisal with NO questions in it — a record that exists, counts towards
 * every progress total, and looks like work in progress right up until the
 * deadline passes with nothing submitted.
 *
 * This answers that question BEFORE a cycle is launched, by running the same
 * code the launch runs rather than a query written afresh each time:
 *
 *   tenant + role ∈ TENANT_ROLES + status:'active'   (launchCycle's own filter)
 *     → planCycleLaunch(...)                          (who gets an appraisal)
 *       → employeesAskedNothing(...)                  (whose form is empty)
 *
 * Reimplementing any of those three by hand is how you get an answer that
 * looks precise and is wrong: a headcount that forgets `status` counts deleted
 * accounts, and one that forgets `planCycleLaunch` counts the owners, who
 * never receive an appraisal at all.
 *
 * READ-ONLY. This script writes nothing under any flag.
 *
 * Usage:
 *   node scripts/check-template-coverage.js --template="Scored Performance"
 *   node scripts/check-template-coverage.js --template=<templateId|familyId>
 *   node scripts/check-template-coverage.js --list
 *   node scripts/check-template-coverage.js --template=… --tenant=<id> --verbose
 *
 * `--template` matches a template id, a family id, or a case-insensitive
 * substring of the name; only the latest non-archived version of a family is
 * considered, which is the version a launch would pin. `--verbose` also lists
 * everyone who IS covered, with their question count.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Department = require('../models/Department');
const EmployeeRole = require('../models/EmployeeRole');
const User = require('../models/User');
const {
  planCycleLaunch,
  employeesAskedNothing,
  filterSections,
  TENANT_ROLES,
} = require('../services/appraisal.helpers');

const arg = (name) =>
  (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=') || null;
const LIST = process.argv.includes('--list');
const VERBOSE = process.argv.includes('--verbose');
const TEMPLATE = arg('template');
const TENANT = arg('tenant');

const nameOf = (u) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || `(no name) ${u?._id}`;

/** Resolve `--template` to one document: an id, a family id, or a name match. */
async function resolveTemplate(filter) {
  if (mongoose.Types.ObjectId.isValid(TEMPLATE)) {
    const byId = await AppraisalTemplate.findOne({ ...filter, _id: TEMPLATE }).lean();
    if (byId) return byId;
    const byFamily = await AppraisalTemplate.findOne({
      ...filter, family: TEMPLATE, isLatest: true,
    }).lean();
    if (byFamily) return byFamily;
  }
  // Escaped: a template named "360° Feedback (v3)" must not be read as a regex.
  const escaped = String(TEMPLATE).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = await AppraisalTemplate.find({
    ...filter,
    name: new RegExp(escaped, 'i'),
    isLatest: true,
    isArchived: { $ne: true },
  }).lean();
  if (matches.length > 1) {
    const err = new Error(
      `"${TEMPLATE}" matches ${matches.length} forms:\n` +
      matches.map((t) => `   ${t._id}  "${t.name}" v${t.version}`).join('\n') +
      '\nRe-run with the id of the one you mean.'
    );
    throw err;
  }
  return matches[0] || null;
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  const tenantFilter = TENANT ? { tenant: TENANT } : {};

  if (LIST || !TEMPLATE) {
    const rows = await AppraisalTemplate.find({
      ...tenantFilter, isLatest: true, isArchived: { $ne: true },
    }).select('name version isDefault tenant sections').lean();
    console.log(rows.length ? 'Forms available:' : 'No forms found.');
    for (const t of rows) {
      const qs = (t.sections || []).reduce((n, s) => n + (s.questions || []).length, 0);
      console.log(`   ${t._id}  "${t.name}" v${t.version}${t.isDefault ? ' (default)' : ''} — ${(t.sections || []).length} sections, ${qs} questions`);
    }
    if (!TEMPLATE) console.log('\nRe-run with --template=<id|name> to check coverage.');
    return;
  }

  const template = await resolveTemplate(tenantFilter);
  if (!template) throw new Error(`No form matches --template=${TEMPLATE}`);

  // The tenant comes from the FORM, not from a flag, so a mistyped --tenant
  // cannot silently produce a coverage report for the wrong company's people.
  const tenant = template.tenant;

  const [departments, roles, owner, employees] = await Promise.all([
    Department.find({ tenant }).select('_id name manager').lean(),
    EmployeeRole.find({ tenant }).select('_id name').lean(),
    User.findOne({ tenant, role: 'tenant_owner' }).select('_id').lean(),
    // Exactly launchCycle's employee query — copied deliberately rather than
    // approximated. Drop `status` and this report counts deleted accounts;
    // drop the planning fields and every employee looks role-less, which
    // makes a role-scoped form look broken when it is the report that is.
    User.find({ tenant, role: { $in: TENANT_ROLES }, status: 'active' })
      .select([
        '_id', 'role', 'firstName', 'lastName', 'email',
        'employeeProfile.work.manager',
        'employeeProfile.work.department',
        'employeeProfile.planning.roles',
        'employeeProfile.planning.defaultRole',
      ].join(' '))
      .lean(),
  ]);

  const departmentName = new Map(departments.map((d) => [String(d._id), d.name]));
  const roleName = new Map(roles.map((r) => [String(r._id), r.name]));
  const rolesOf = (row) =>
    (row.roles || []).map((r) => roleName.get(String(r)) || String(r)).join(' + ') || 'no role';
  const departmentManagerOf = new Map(
    departments.filter((d) => d.manager).map((d) => [String(d._id), String(d.manager)])
  );

  // `existingEmployeeIds` is empty: this reports on a fresh launch. Against a
  // cycle that has already run, the people who already have an appraisal would
  // come back as `alreadyExists` and drop out of the coverage question.
  const plan = planCycleLaunch(employees, [], {
    departmentManagerOf,
    ownerId: owner?._id || null,
  });
  const gap = employeesAskedNothing(template.sections, plan.toCreate);
  const byId = new Map(employees.map((e) => [String(e._id), e]));
  const gapIds = new Set(gap.map((g) => String(g.employee)));
  // Keyed on the PLANNED row, not the user document: the row holds the roles
  // a launch would snapshot (appraisalRolesFor picks them), and those are what
  // the form is actually filtered by.
  const rowOf = new Map(plan.toCreate.map((r) => [String(r.employee), r]));

  const totalQuestions = (template.sections || []).reduce(
    (n, s) => n + (s.questions || []).length, 0
  );
  console.log(`FORM  "${template.name}" v${template.version}  (${template._id})`);
  console.log(`      ${(template.sections || []).length} sections, ${totalQuestions} questions`);
  console.log(`      tenant ${tenant}\n`);
  console.log(`A NEW CYCLE ON THIS FORM WOULD:`);
  console.log(`   create  ${plan.toCreate.length} appraisals`);
  console.log(`   skip    ${plan.skipped.length} (no reviewer — no appraisal at all)`);
  console.log(`   of those created, ${gap.length} would have NO questions\n`);

  if (plan.skipped.length) {
    console.log('SKIPPED — no appraisal is created for these people:');
    for (const s of plan.skipped) {
      const u = byId.get(String(s.employee));
      const dept = departmentName.get(String(u?.employeeProfile?.work?.department)) || 'no department';
      console.log(`   ${nameOf(u)} <${u?.email || '?'}> — ${s.reason} — ${dept}`);
    }
    console.log('');
  }

  if (gap.length) {
    console.log('EMPTY FORM — these appraisals would be created with nothing to answer:');
    for (const g of gap) {
      const u = byId.get(String(g.employee));
      const dept = departmentName.get(String(g.department)) || 'NO DEPARTMENT SET';
      console.log(`   ${nameOf(u)} <${u?.email || '?'}> — ${dept} — ${rolesOf(rowOf.get(String(g.employee)) || {})}`);
    }
    console.log('\n   Fix by giving the form a section for those departments or roles, by');
    console.log('   leaving one section unscoped (an empty department AND role list reaches');
    console.log('   everybody), or by setting the department or role on the employees who');
    console.log('   have none. A section naming both is an AND: it reaches only a holder of');
    console.log('   that role INSIDE that department.\n');
  } else {
    console.log('EMPTY FORM — none. Every appraisal this launch creates has questions in it.\n');
  }

  if (VERBOSE) {
    console.log('COVERED:');
    for (const row of plan.toCreate) {
      if (gapIds.has(String(row.employee))) continue;
      const u = byId.get(String(row.employee));
      const scope = { departmentId: row.department, roleIds: row.roles };
      const self = filterSections(template.sections, { kind: 'self', ...scope });
      const manager = filterSections(template.sections, { kind: 'manager', ...scope });
      const count = (secs) => secs.reduce((n, s) => n + s.questions.length, 0);
      const dept = departmentName.get(String(row.department)) || 'no department';
      console.log(
        `   ${nameOf(u)} — ${dept} — ${rolesOf(row)} — self ${count(self)} q, manager ${count(manager)} q`
      );
    }
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
