// server/services/employee.helpers.js
//
// Pure, side-effect-free helpers for tenant employee (staff) management.
// Kept separate from the controller so the validation/authorisation rules can
// be unit-tested without a database or Express request — mirrors the pattern
// used by poReceive.helpers.js / batch.service.js.

// Roles that count as "employees" of a tenant (everything except customers and
// the platform-level super_admin/admin).
const EMPLOYEE_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

// Roles a tenant admin is allowed to assign through this surface. They can never
// create another tenant_owner or escalate someone to a platform role.
const ASSIGNABLE_ROLES = ['tenant_admin', 'tenant_staff'];

// User.status values an admin may set here (the schema also has 'deleted', which
// is reserved for soft-deletes and never settable directly).
const SETTABLE_STATUSES = ['active', 'inactive', 'suspended'];

// Must match the enum in models/User.js → posPermissions.
const POS_PERMISSIONS = [
  'pos:sell',
  'pos:refund',
  'pos:void',
  'pos:price_override',
  'pos:discount',
  'pos:terminal:retail',
  'pos:terminal:wholesale',
];

/** A 4–6 digit numeric PIN. */
function isValidPin(pin) {
  return /^\d{4,6}$/.test(String(pin));
}

/** Basic email shape check (server-side guard, not RFC-complete). */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Keep only recognised POS permissions, de-duplicated. Returns undefined when
 * the input isn't an array so callers can "leave unchanged".
 */
function sanitizePermissions(perms) {
  if (!Array.isArray(perms)) return undefined;
  return [...new Set(perms.filter((p) => POS_PERMISSIONS.includes(p)))];
}

/**
 * Build the Mongo filter for listing a tenant's employees.
 *
 * @param {*}      tenantId               - req.tenant._id
 * @param {object} [opts]
 * @param {string} [opts.role]            - exact role filter (must be an employee role)
 * @param {string} [opts.status]          - exact status filter (must be settable)
 * @param {string} [opts.search]          - free-text across name/email/phone/posName
 * @returns {object} a Mongoose filter object
 */
function buildEmployeeFilter(tenantId, opts = {}) {
  const { role, status, search } = opts;

  const filter = {
    tenant: tenantId,
    role: { $in: EMPLOYEE_ROLES },
    status: { $ne: 'deleted' },
  };

  if (role && EMPLOYEE_ROLES.includes(role)) {
    filter.role = role;
  }
  if (status && SETTABLE_STATUSES.includes(status)) {
    filter.status = status;
  }

  const term = typeof search === 'string' ? search.trim() : '';
  if (term) {
    // Escape regex metacharacters so a search like "a.b" is treated literally.
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [
      { firstName: rx },
      { lastName: rx },
      { email: rx },
      { phone: rx },
      { posName: rx },
    ];
  }

  return filter;
}

/**
 * Validate + normalise the payload for creating an employee.
 * @returns {{ ok: true, value: object } | { ok: false, message: string }}
 */
function buildCreatePayload(body = {}, tenantId) {
  const { firstName, lastName, email, phone, role, status, posAccess, posName, posPermissions, pin } = body;

  if (!firstName || !String(firstName).trim()) {
    return { ok: false, message: 'First name is required' };
  }
  if (!isValidEmail(email)) {
    return { ok: false, message: 'A valid email is required' };
  }

  const resolvedRole = role === undefined ? 'tenant_staff' : role;
  if (!ASSIGNABLE_ROLES.includes(resolvedRole)) {
    return { ok: false, message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` };
  }

  const resolvedStatus = status === undefined ? 'active' : status;
  if (!SETTABLE_STATUSES.includes(resolvedStatus)) {
    return { ok: false, message: `Status must be one of: ${SETTABLE_STATUSES.join(', ')}` };
  }

  if (pin !== undefined && pin !== null && pin !== '' && !isValidPin(pin)) {
    return { ok: false, message: 'PIN must be 4–6 digits' };
  }

  const wantsPos = posAccess === undefined ? false : Boolean(posAccess);
  const value = {
    firstName: String(firstName).trim(),
    lastName: lastName ? String(lastName).trim() : '',
    email: String(email).toLowerCase().trim(),
    phone: phone ? String(phone).trim() : undefined,
    role: resolvedRole,
    tenant: tenantId,
    status: resolvedStatus,
    posAccess: wantsPos,
    posName: posName ? String(posName).trim() : String(firstName).trim(),
    isEmailVerified: true,
  };

  const cleanPerms = sanitizePermissions(posPermissions);
  if (cleanPerms) {
    value.posPermissions = cleanPerms;
  } else if (wantsPos) {
    value.posPermissions = ['pos:sell', 'pos:terminal:retail', 'pos:terminal:wholesale'];
  }

  return { ok: true, value };
}

/**
 * Compute the field changes to apply to an existing employee document.
 * Validates role/status transitions and protects the tenant owner.
 *
 * @param {object} target   - the existing user (plain object or doc)
 * @param {object} body     - request body
 * @returns {{ ok: true, changes: object } | { ok: false, message: string }}
 */
function buildUpdateChanges(target, body = {}) {
  const { firstName, lastName, phone, role, status, posAccess, posName, posPermissions } = body;
  const changes = {};

  if (firstName !== undefined) {
    if (!String(firstName).trim()) return { ok: false, message: 'First name cannot be empty' };
    changes.firstName = String(firstName).trim();
  }
  if (lastName !== undefined) changes.lastName = String(lastName).trim();
  if (phone !== undefined) changes.phone = phone ? String(phone).trim() : '';

  if (role !== undefined && role !== target.role) {
    if (target.role === 'tenant_owner') {
      return { ok: false, message: "The tenant owner's role cannot be changed" };
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return { ok: false, message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` };
    }
    changes.role = role;
  }

  if (status !== undefined && status !== target.status) {
    if (!SETTABLE_STATUSES.includes(status)) {
      return { ok: false, message: `Status must be one of: ${SETTABLE_STATUSES.join(', ')}` };
    }
    if (target.role === 'tenant_owner' && status !== 'active') {
      return { ok: false, message: 'The tenant owner must remain active' };
    }
    changes.status = status;
  }

  if (posAccess !== undefined) changes.posAccess = Boolean(posAccess);
  if (posName !== undefined) changes.posName = String(posName).trim();

  const cleanPerms = sanitizePermissions(posPermissions);
  if (cleanPerms) changes.posPermissions = cleanPerms;

  return { ok: true, changes };
}

/**
 * Authorisation check for deleting an employee.
 * @param {object} target            - the user being deleted
 * @param {*}      requestingUserId   - id of the admin making the request
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
function canDeleteEmployee(target, requestingUserId) {
  if (!target) return { ok: false, message: 'Employee not found' };
  if (target.role === 'tenant_owner') {
    return { ok: false, message: 'The tenant owner cannot be deleted' };
  }
  if (requestingUserId && String(target._id) === String(requestingUserId)) {
    return { ok: false, message: 'You cannot delete your own account' };
  }
  return { ok: true };
}

module.exports = {
  EMPLOYEE_ROLES,
  ASSIGNABLE_ROLES,
  SETTABLE_STATUSES,
  POS_PERMISSIONS,
  isValidPin,
  isValidEmail,
  sanitizePermissions,
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  canDeleteEmployee,
};
