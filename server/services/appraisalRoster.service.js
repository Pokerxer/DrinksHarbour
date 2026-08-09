// server/services/appraisalRoster.service.js
//
// The one place the appraisal module turns "who still works here" into a query
// fragment.
//
// Deleting an employee is a SOFT delete — employee.controller.js#deleteEmployee
// sets `User.status = 'deleted'` and keeps the row, so history, payroll and the
// audit trail survive and an accidental delete is undoable. Every other module
// that reads people already honours that (`{status: {$ne: 'deleted'}}` in
// attendance, time off, shifts and the employee list itself); the appraisal
// module did not, so a person removed from the tenant went on appearing in
// cycle rosters, state counts, reports and a manager's team list forever.
//
// Two shapes, for the same reason appraisalScope.service.js has two: an
// aggregation `$match` does no schema casting, so the ids have to be real
// ObjectIds there. They come straight out of a query here, so both are served
// by one list — but the split is kept so no caller has to think about it.
//
// This EXCLUDES, it never includes: the filter is built from the deleted
// people, not from the live ones. A tenant with 400 staff and 3 leavers pays
// for a 3-element `$nin` rather than a 400-element `$in`, and — more
// importantly — a query that failed to load the live list would silently match
// nobody, whereas one that fails to load the deleted list falls back to
// showing everything. Under-filtering is a cosmetic bug; over-filtering hides
// a live employee's performance record.
const User = require('../models/User');
const {
  departmentScopeFor, departmentFilter, departmentMatch,
} = require('./appraisalScope.service');

/**
 * Every deleted user in `req`'s tenant, memoised on the request.
 *
 * Memoised because a single handler resolves this more than once (cycleProgress
 * filters appraisals and then narrows feedback through them), and the answer
 * cannot change within a request.
 *
 * A missing tenant returns an EMPTY list rather than querying: mongoose strips
 * `undefined` out of a filter, so `{tenant: undefined, status: 'deleted'}`
 * would collapse to "every deleted user in the database" and start excluding
 * other tenants' ids from this tenant's queries. Harmless today — an id from
 * another tenant cannot match here anyway — but it is the same footgun that
 * has bitten this module before, and the handlers all guard the tenant
 * themselves.
 */
async function deletedEmployeeIdsFor(req) {
  if (req && Object.prototype.hasOwnProperty.call(req, '_appraisalDeletedEmployees')) {
    return req._appraisalDeletedEmployees;
  }
  const tenantId = req?.tenant?._id;
  const rows = tenantId
    ? await User.find({ tenant: tenantId, status: 'deleted' }).select('_id').lean()
    : [];
  const ids = rows.map((r) => r._id);
  if (req) req._appraisalDeletedEmployees = ids;
  return ids;
}

/**
 * `{}` when nobody has been deleted, otherwise `{<field>: {$nin: [...]}}`.
 *
 * The empty case is returned as `{}` rather than `{$nin: []}` — the two are
 * equivalent to mongo, and an empty fragment keeps the logged query readable
 * for the overwhelmingly common tenant that has never deleted anyone.
 */
function excludeDeleted(deletedIds, field = 'employee') {
  return deletedIds && deletedIds.length ? { [field]: { $nin: deletedIds } } : {};
}

/**
 * The complete "which appraisals may this request see" filter: the caller's
 * department scope AND the live-employee rule, in one call.
 *
 * Combined deliberately. These are two independent rules and every list,
 * count and report in the module needs both; a handler that composed them by
 * hand could apply one and forget the other, which is exactly how the deleted
 * employees survived in the roster while the department scope was applied
 * around them.
 */
async function visibleAppraisalFilter(req) {
  const [scope, deleted] = await Promise.all([
    departmentScopeFor(req),
    deletedEmployeeIdsFor(req),
  ]);
  return { ...departmentFilter(scope), ...excludeDeleted(deleted) };
}

/** The same fragment for an aggregation `$match`. See departmentMatch. */
async function visibleAppraisalMatch(req) {
  const [scope, deleted] = await Promise.all([
    departmentScopeFor(req),
    deletedEmployeeIdsFor(req),
  ]);
  return { ...departmentMatch(scope), ...excludeDeleted(deleted) };
}

module.exports = {
  deletedEmployeeIdsFor,
  excludeDeleted,
  visibleAppraisalFilter,
  visibleAppraisalMatch,
};
