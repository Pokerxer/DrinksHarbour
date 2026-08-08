// server/services/appraisalScope.service.js
//
// The one place the appraisal module turns "who is this user" into "which
// departments may they look into" (Phase 5 §9.4).
//
// scopeDepartmentsFor in appraisal.helpers.js holds the RULE and is DB-free;
// this holds the single query that feeds it, so cycleRoster, the cycle report,
// the cycle state counts and appraisal detail all resolve their scope the same
// way. That is the point: resolveAppraisalAccess fails closed when no scope is
// supplied, so an endpoint that forgets this call denies rather than leaks —
// but an endpoint that rolls its own query could still get the rule wrong, and
// there is no reason for a second one to exist.
const mongoose = require('mongoose');
const Department = require('../models/Department');
const { scopeDepartmentsFor } = require('./appraisal.helpers');

/**
 * The department scope for `req.user`, memoised on the request.
 *
 * Returns `null` for an unrestricted viewer (tenant_owner, super_admin, and
 * the legacy platform `admin`) and an array of department id strings — possibly
 * empty — for a `tenant_admin`.
 *
 * Memoised because several handlers resolve access more than once per request
 * (getAppraisal reads, then releaseAppraisal re-reads), and the answer cannot
 * change within a request. `null` is a meaningful value here, so the cache is
 * keyed on the property EXISTING, never on it being truthy.
 */
async function departmentScopeFor(req) {
  if (req && Object.prototype.hasOwnProperty.call(req, '_appraisalDepartmentScope')) {
    return req._appraisalDepartmentScope;
  }
  const user = req?.user;
  // Ask the rule first: an unrestricted role needs no query at all, so the
  // owner's every page load does not pay for one.
  if (scopeDepartmentsFor(user, []) === null) {
    if (req) req._appraisalDepartmentScope = null;
    return null;
  }
  // Tenant-scoped as well as manager-scoped: a manager id is not a tenant
  // boundary on its own. A missing tenant must never reach the filter —
  // mongoose strips `undefined` out, so {tenant: undefined} matches everything.
  const tenantId = req?.tenant?._id;
  const managed = tenantId
    ? await Department.find({ tenant: tenantId, manager: user._id }).select('_id').lean()
    : [];
  const scope = scopeDepartmentsFor(user, managed.map((d) => d._id));
  if (req) req._appraisalDepartmentScope = scope;
  return scope;
}

/**
 * A mongo filter fragment restricting a query to the caller's departments.
 *
 * `{}` when unrestricted. Otherwise `{department: {$in: [...]}}`, which for an
 * admin who manages nothing is `{$in: []}` — a filter that matches nothing,
 * which is the correct answer and NOT an accident to be optimised away into an
 * unfiltered query.
 *
 * Note that this deliberately excludes appraisals with no department at all
 * (every record launched before Phase 5), matching resolveAppraisalAccess: an
 * unscoped record belongs to the owner to look at.
 */
function departmentFilter(scope, field = 'department') {
  if (scope === null) return {};
  return { [field]: { $in: scope } };
}

/**
 * The same fragment for an AGGREGATION `$match`.
 *
 * Aggregate pipelines do no schema casting, so a string id there matches
 * nothing at all — which reads as "this admin's departments are empty" rather
 * than as the bug it is. Ids that fail to cast are dropped rather than thrown
 * on: they cannot match a stored ObjectId either way, and a scope built from
 * the database should never contain one.
 */
function departmentMatch(scope, field = 'department') {
  if (scope === null) return {};
  const ids = (scope || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  return { [field]: { $in: ids } };
}

module.exports = { departmentScopeFor, departmentFilter, departmentMatch };
