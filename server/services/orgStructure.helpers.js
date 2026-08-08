// server/services/orgStructure.helpers.js
//
// Pure, side-effect-free helpers for the tenant org structure: departments, job
// positions and (HR/planning) employee roles. Kept out of the controller so the
// validation, nesting and delete-guard rules can be unit-tested without a
// database or an Express request — same split as employee.helpers.js.
//
// Note on vocabulary: `EmployeeRole` here is an HR/planning role (Cashier,
// Bartender, Driver) used to staff shifts. It has nothing to do with the
// access-control role on User (`tenant_owner` / `tenant_admin` / `tenant_staff`),
// which is a fixed enum and is deliberately not editable through this surface.

/** Employment types a job position may carry. Mirrors the model enum. */
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern', 'temporary'];

// A 24-character hex string. Used to reject junk before it reaches Mongoose,
// which would otherwise throw a CastError that surfaces as a 500 rather than a
// 400 the client can act on.
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/** True when `v` can be cast to an ObjectId. */
function isObjectIdLike(v) {
  if (!v) return false;
  // A populated document or an already-cast ObjectId both stringify correctly.
  const s = typeof v === 'object' && v._id ? String(v._id) : String(v);
  return OBJECT_ID_RE.test(s);
}

/**
 * Normalise an org entity name into a comparison key: case-folded, with
 * surrounding and interior whitespace collapsed.
 *
 * Interior collapse matters for the migration — free-text data contains both
 * "Front Desk" and "Front  Desk", and treating them as two departments would
 * produce exactly the duplicate rows this work exists to remove.
 */
function orgNameKey(name) {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Index existing records by their normalised name. First write wins, so a
 * pre-existing canonical row is never displaced by a later near-duplicate.
 *
 * @param {Array<{name: string}>} records
 * @returns {Map<string, object>}
 */
function buildNameIndex(records = []) {
  const idx = new Map();
  for (const r of records) {
    const key = orgNameKey(r?.name);
    if (key && !idx.has(key)) idx.set(key, r);
  }
  return idx;
}

/**
 * Build the Mongo filter for listing any of the three org entities.
 *
 * @param {*}      tenantId
 * @param {object} [opts]
 * @param {string} [opts.search]      - free text over name/code
 * @param {*}      [opts.isActive]    - 'true'/'false'/boolean; omitted means both
 * @param {string} [opts.department]  - job positions only
 */
function buildOrgFilter(tenantId, opts = {}) {
  const { search, isActive, department } = opts;
  const filter = { tenant: tenantId };

  // Deliberately tri-state. An absent flag means "active and inactive", because
  // an admin looking for a row to reactivate has to be able to see it.
  if (isActive === true || isActive === 'true') filter.isActive = true;
  else if (isActive === false || isActive === 'false') filter.isActive = false;

  if (isObjectIdLike(department)) filter.department = department;

  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ name: rx }, { code: rx }];
  }

  return filter;
}

// ── Field coercion ────────────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Coerce a reference field. Returns `null` for an explicit clear ('' or null),
 * `undefined` when the caller did not send the field at all, and an error
 * marker when the value is present but unusable.
 */
function refField(value) {
  if (value === undefined) return { skip: true };
  if (value === null || value === '') return { value: null };
  if (!isObjectIdLike(value)) return { bad: true };
  return { value: typeof value === 'object' && value._id ? String(value._id) : String(value) };
}

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Shared name handling for all three entities.
 * @returns {{ok: true, name?: string} | {ok: false, message: string}}
 */
function resolveName(body, isUpdate, label) {
  if (body.name === undefined) {
    if (isUpdate) return { ok: true };
    return { ok: false, message: `${label} name is required` };
  }
  const name = trimmed(body.name);
  if (!name) return { ok: false, message: `${label} name cannot be empty` };
  return { ok: true, name };
}

/**
 * Apply the fields common to every org entity (name, color, note, isActive).
 * Mutates `value`; returns an error result or null.
 */
function applyCommonFields(body, value, isUpdate, label) {
  const named = resolveName(body, isUpdate, label);
  if (!named.ok) return named;
  if (named.name !== undefined) value.name = named.name;

  if (body.color !== undefined) {
    const color = trimmed(body.color);
    // '' clears the colour; anything non-empty must be a real hex value, or the
    // roster renders a broken swatch.
    if (color && !HEX_COLOR_RE.test(color)) {
      return { ok: false, message: 'Colour must be a hex value like #b20202' };
    }
    value.color = color;
  }

  if (body.note !== undefined) value.note = trimmed(body.note);
  if (body.isActive !== undefined) value.isActive = Boolean(body.isActive);
  else if (!isUpdate) value.isActive = true;

  return null;
}

/**
 * Validate + normalise a Department payload.
 * @param {object} body
 * @param {{isUpdate?: boolean}} [opts]
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildDepartmentPayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  const common = applyCommonFields(body, value, isUpdate, 'Department');
  if (common) return common;

  if (body.code !== undefined) value.code = trimmed(body.code).toUpperCase();

  for (const field of ['parent', 'manager']) {
    const ref = refField(body[field]);
    if (ref.bad) return { ok: false, message: `${field} must be a valid id` };
    if (!ref.skip) value[field] = ref.value;
  }

  return { ok: true, value };
}

/**
 * Validate + normalise a JobPosition payload.
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildJobPositionPayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  const common = applyCommonFields(body, value, isUpdate, 'Job position');
  if (common) return common;

  const dept = refField(body.department);
  if (dept.bad) return { ok: false, message: 'department must be a valid id' };
  if (!dept.skip) value.department = dept.value;

  if (body.employmentType !== undefined) {
    if (!EMPLOYMENT_TYPES.includes(body.employmentType)) {
      return { ok: false, message: `Employment type must be one of: ${EMPLOYMENT_TYPES.join(', ')}` };
    }
    value.employmentType = body.employmentType;
  } else if (!isUpdate) {
    value.employmentType = 'full_time';
  }

  if (body.expectedHeadcount !== undefined) {
    const n = Number(body.expectedHeadcount);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: 'Expected headcount must be zero or more' };
    }
    value.expectedHeadcount = n;
  }

  if (body.description !== undefined) value.description = trimmed(body.description);
  if (body.requirements !== undefined) value.requirements = trimmed(body.requirements);

  return { ok: true, value };
}

/**
 * Validate + normalise an EmployeeRole payload.
 * @returns {{ok: true, value: object} | {ok: false, message: string}}
 */
function buildEmployeeRolePayload(body = {}, opts = {}) {
  const isUpdate = Boolean(opts.isUpdate);
  const value = {};

  const common = applyCommonFields(body, value, isUpdate, 'Role');
  if (common) return common;

  if (body.hourlyCost !== undefined) {
    const n = Number(body.hourlyCost);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, message: 'Hourly cost must be zero or more' };
    }
    value.hourlyCost = n;
  }

  return { ok: true, value };
}

/**
 * Validate a department's `parent`, guarding self-parenting and nesting cycles.
 * Mirrors validateManagerAssignment in employee.helpers.js — same shape of
 * problem (a self-referential tree), same shape of answer.
 *
 * @param {*} parentId
 * @param {{selfId?: *, parentOf: Map<string, string>}} opts
 *        `parentOf` maps departmentId → its current parentId ('' when none).
 * @returns {{ok: true} | {ok: false, message: string}}
 */
function validateParentAssignment(parentId, opts = {}) {
  const { selfId = null, parentOf } = opts;
  const pid = parentId ? String(parentId) : '';
  if (!pid) return { ok: true };

  const graph = parentOf instanceof Map ? parentOf : new Map();
  if (!graph.has(pid)) {
    return { ok: false, message: 'Parent must be an existing department in your organisation' };
  }

  const self = selfId ? String(selfId) : '';
  if (self && pid === self) {
    return { ok: false, message: 'A department cannot be its own parent' };
  }

  // Walk up from the proposed parent; reaching self means this edge closes a
  // loop. `seen` guards against a cycle that already exists in the data, which
  // would otherwise spin forever.
  if (self) {
    let cur = pid;
    const seen = new Set();
    while (cur) {
      if (cur === self) {
        return { ok: false, message: 'This parent assignment would create a nesting cycle' };
      }
      if (seen.has(cur)) break;
      seen.add(cur);
      const up = graph.get(cur);
      cur = up ? String(up) : '';
    }
  }

  return { ok: true };
}

// Blocker key → singular/plural noun. Order here is the order they appear in
// the message.
const BLOCKER_LABELS = {
  employees: ['employee', 'employees'],
  positions: ['job position', 'job positions'],
  children: ['sub-department', 'sub-departments'],
  templates: ['shift template', 'shift templates'],
  shifts: ['scheduled shift', 'scheduled shifts'],
};

/**
 * Turn reference counts into a delete decision. Deleting an org entity that is
 * still referenced would leave dangling refs on employees — the exact class of
 * bug that blanked the warehouse pages — so this blocks and tells the admin to
 * deactivate instead.
 *
 * @param {Record<string, number>} counts
 * @returns {{ok: true} | {ok: false, message: string}}
 */
function describeDeleteBlockers(counts = {}) {
  const parts = [];
  for (const [key, [one, many]] of Object.entries(BLOCKER_LABELS)) {
    const n = Number(counts[key]) || 0;
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  }

  if (!parts.length) return { ok: true };

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return {
    ok: false,
    message: `Still referenced by ${list}. Reassign them first, or deactivate this record instead of deleting it.`,
  };
}

module.exports = {
  EMPLOYMENT_TYPES,
  isObjectIdLike,
  orgNameKey,
  buildNameIndex,
  buildOrgFilter,
  buildDepartmentPayload,
  buildJobPositionPayload,
  buildEmployeeRolePayload,
  validateParentAssignment,
  describeDeleteBlockers,
};
