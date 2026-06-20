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
 * Normalise an avatar payload into the `{ url, publicId }` shape stored on the
 * User model. Accepts either a plain URL string or an object from the upload
 * service. Returns null when there's nothing usable (so callers can "clear").
 */
function sanitizeAvatar(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const url = input.trim();
    return url ? { url } : null;
  }
  if (typeof input === 'object') {
    const url = typeof input.url === 'string' ? input.url.trim() : '';
    if (!url) return null;
    const out = { url };
    const publicId =
      typeof input.publicId === 'string' ? input.publicId.trim() : '';
    if (publicId) out.publicId = publicId;
    return out;
  }
  return null;
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

const GENDERS = ['male', 'female', 'other', ''];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed', 'cohabitant', ''];

// String coercion helpers used by the profile sanitiser. Empty/blank strings
// collapse to undefined so they're dropped rather than stored as "".
const str = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
};
const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const dateVal = (v) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const oneOf = (v, allowed) => (allowed.includes(v) ? v : undefined);

// Drop keys whose value is undefined so we never overwrite stored data with
// blanks the client didn't send.
const compact = (obj) => {
  const out = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    out[k] = val;
  }
  return out;
};

/**
 * Whitelist + coerce an Odoo-style HR profile payload into a safe shape for the
 * User.employeeProfile subdocument. Unknown keys are ignored; types are coerced;
 * enums are validated. Returns a (possibly nested) plain object.
 */
function buildEmployeeProfile(input) {
  if (!input || typeof input !== 'object') return {};
  const p = input;

  const bankAccounts = Array.isArray(p.privateContact?.bankAccounts)
    ? p.privateContact.bankAccounts
        .map((b) =>
          compact({
            bankName: str(b?.bankName),
            accountNumber: str(b?.accountNumber),
            accountName: str(b?.accountName),
          })
        )
        .filter((b) => Object.keys(b).length > 0)
    : undefined;

  const roles = Array.isArray(p.planning?.roles)
    ? p.planning.roles.map((r) => str(r)).filter(Boolean)
    : undefined;

  return compact({
    privateContact: compact({
      email: p.privateContact?.email ? String(p.privateContact.email).toLowerCase().trim() : undefined,
      phone: str(p.privateContact?.phone),
      bankAccounts,
    }),
    personal: compact({
      legalName: str(p.personal?.legalName),
      birthday: dateVal(p.personal?.birthday),
      placeOfBirthCity: str(p.personal?.placeOfBirthCity),
      placeOfBirthCountry: str(p.personal?.placeOfBirthCountry),
      gender: oneOf(p.personal?.gender, GENDERS),
      payslipLanguage: str(p.personal?.payslipLanguage),
    }),
    emergencyContact: compact({
      name: str(p.emergencyContact?.name),
      phone: str(p.emergencyContact?.phone),
    }),
    visaWorkPermit: compact({
      visaNo: str(p.visaWorkPermit?.visaNo),
      workPermitNo: str(p.visaWorkPermit?.workPermitNo),
      documentUrl: str(p.visaWorkPermit?.documentUrl),
    }),
    citizenship: compact({
      nationality: str(p.citizenship?.nationality),
      nonResident: p.citizenship?.nonResident === undefined ? undefined : Boolean(p.citizenship.nonResident),
      identificationNo: str(p.citizenship?.identificationNo),
      ssnNo: str(p.citizenship?.ssnNo),
      passportNo: str(p.citizenship?.passportNo),
    }),
    location: compact({
      address: compact({
        street: str(p.location?.address?.street),
        street2: str(p.location?.address?.street2),
        city: str(p.location?.address?.city),
        state: str(p.location?.address?.state),
        zip: str(p.location?.address?.zip),
        country: str(p.location?.address?.country),
      }),
      homeWorkDistanceKm: num(p.location?.homeWorkDistanceKm),
    }),
    family: compact({
      maritalStatus: oneOf(p.family?.maritalStatus, MARITAL_STATUSES),
      dependentChildren: num(p.family?.dependentChildren),
    }),
    education: compact({
      certificateLevel: str(p.education?.certificateLevel),
      fieldOfStudy: str(p.education?.fieldOfStudy),
    }),
    documents: compact({
      idCardUrl: str(p.documents?.idCardUrl),
      drivingLicenseUrl: str(p.documents?.drivingLicenseUrl),
      simCardUrl: str(p.documents?.simCardUrl),
      internetInvoiceUrl: str(p.documents?.internetInvoiceUrl),
    }),
    appraisal: compact({
      nextAppraisalDate: dateVal(p.appraisal?.nextAppraisalDate),
    }),
    approvers: compact({
      hrResponsible: str(p.approvers?.hrResponsible),
      expense: str(p.approvers?.expense),
      timeOff: str(p.approvers?.timeOff),
    }),
    planning: compact({
      roles,
      defaultRole: str(p.planning?.defaultRole),
    }),
    appSettings: compact({
      analyticDistribution: str(p.appSettings?.analyticDistribution),
      hourlyCost: num(p.appSettings?.hourlyCost),
    }),
    attendance: compact({
      rfidBadge: str(p.attendance?.rfidBadge),
    }),
    timezone: str(p.timezone),
  });
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
  sanitizeAvatar,
  sanitizePermissions,
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  buildEmployeeProfile,
  canDeleteEmployee,
  GENDERS,
  MARITAL_STATUSES,
};
