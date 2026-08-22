// server/controllers/employee.controller.js
//
// Tenant staff (employee) management. Broader than POS cashier CRUD: covers
// every employee role (tenant_owner / tenant_admin / tenant_staff) and lets a
// tenant admin manage role, status and POS access from one place.
//
// All routes are guarded by tenantAdminOrSuperAdmin and every query is scoped to
// req.tenant._id so one tenant can never see or touch another's staff.

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const asyncHandler = require('../utils/asyncHandler');
const {
  EMPLOYEE_ROLES,
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  buildEmployeeProfile,
  validateManagerAssignment,
  canDeleteEmployee,
  isValidPin,
  sanitizeAvatar,
} = require('../services/employee.helpers');
const {
  assignBadgeNumber,
  needsBadgeNumber,
  withBadgeNumber,
  carryOverBadgeNumber,
  isDuplicateBadgeNumberError,
} = require('../services/badgeNumber.helpers');

/**
 * Build the tenant's reporting graph: employeeId → their current managerId, for
 * every non-deleted employee. Used to enforce that a `work.manager` points at a
 * real colleague and never forms a cycle.
 */
async function loadManagerGraph(tenantId) {
  const peers = await User.find({
    tenant: tenantId,
    role: { $in: EMPLOYEE_ROLES },
    status: { $ne: 'deleted' },
  })
    .select('_id employeeProfile.work.manager')
    .lean();
  return new Map(
    peers.map((p) => [
      String(p._id),
      p.employeeProfile?.work?.manager
        ? String(p.employeeProfile.work.manager)
        : '',
    ])
  );
}

// Fields safe to return to the client — never the password or PIN hash.
// `customRole` ships only through present(), which projects it to
// {_id, name, color}; the ref id alone is in PUBLIC_FIELDS so populate() has
// something to work with.
const PUBLIC_FIELDS =
  'firstName lastName email phone avatar role status posAccess posName posPermissions customRole createdAt';

// The employeeProfile subtrees the LIST ships. An allowlist, not the whole
// profile: its siblings hold bank accounts, passport and SSN numbers, home
// addresses, ID-card URLs and hourly pay, and none of that belongs in a
// response every employees screen fetches for every member of staff. The
// detail endpoint returns the full document, which is where HR reads them.
//
// Both entries are here because a screen needs them, and a subtree missing
// from this list is INVISIBLE rather than loud: `present()` passes the
// truncated profile straight through, so the client sees an absent field and
// falls back. That is exactly how the badge number came to look unissued —
// `.attendance` was not here, so `badgePayload()` fell through to the
// employee's _id and the list offered "Issue badge number" for somebody who
// had held one for weeks. Adding a subtree is a deliberate act; so is
// adding a field UNDER one — anything sensitive landing under
// `attendance` or `work` starts shipping here the moment it is declared.
const LIST_PROFILE_FIELDS =
  // manager + titles, for the org chart and the manager picker
  'employeeProfile.work ' +
  // rfidBadge: the number printed on the staff card, which the list needs to
  // know is already issued
  'employeeProfile.attendance';

// Shape a user document into the API's Employee object. `hasPin` is derived so
// the UI can show "PIN set" without ever exposing the hash. `customRole` is
// projected to a tiny {_id, name, color} — the full permission list is the
// roles screen's business, not every employee row's.
function present(user) {
  const populated = user.customRole;
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || '',
    // Stored as { url, publicId }; the client only needs the URL string.
    avatar: user.avatar?.url || '',
    role: user.role,
    status: user.status,
    posAccess: Boolean(user.posAccess),
    posName: user.posName || '',
    posPermissions: user.posPermissions || [],
    hasPin: Boolean(user.posPinHash),
    customRole:
      populated && populated.name
        ? { _id: populated._id, name: populated.name, color: populated.color || '' }
        : null,
    employeeProfile: user.employeeProfile || {},
    createdAt: user.createdAt,
  };
}

// ─── List ──────────────────────────────────────────────────────────────────────

exports.listEmployees = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const filter = buildEmployeeFilter(tenantId, {
    role: req.query.role,
    status: req.query.status,
    search: req.query.search,
  });

  const employees = await User.find(filter)
    .select(`${PUBLIC_FIELDS} posPinHash ${LIST_PROFILE_FIELDS}`)
    .populate('customRole', 'name color')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: { employees: employees.map(present) },
  });
});

// ─── Get one ───────────────────────────────────────────────────────────────────

exports.getEmployee = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  // +posPinHash so the response's hasPin flag is accurate (the field is
  // select:false by default).
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId })
    .select('+posPinHash')
    .populate('customRole', 'name color');
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }
  res.json({ success: true, data: { employee: present(user) } });
});

// ─── Create ────────────────────────────────────────────────────────────────────

exports.createEmployee = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  const built = buildCreatePayload(req.body, tenantId);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }

  const existing = await User.findOne({ email: built.value.email });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Email already in use' });
  }

  const userData = {
    ...built.value,
    // Random throwaway password — employees authenticate via the normal invite /
    // reset flow or a POS PIN, never with this value.
    passwordHash: await bcrypt.hash(`${Math.random().toString(36)}${Date.now()}`, 10),
  };

  const { pin } = req.body;
  if (pin !== undefined && pin !== null && pin !== '') {
    userData.posPinHash = await bcrypt.hash(String(pin), 10);
  }

  if ('avatar' in req.body) {
    const avatar = sanitizeAvatar(req.body.avatar);
    if (avatar) userData.avatar = avatar;
  }

  if (req.body.employeeProfile) {
    const profile = buildEmployeeProfile(req.body.employeeProfile);
    const managerId = profile.work?.manager;
    if (managerId) {
      const check = validateManagerAssignment(managerId, {
        selfId: null,
        managerOf: await loadManagerGraph(tenantId),
      });
      if (!check.ok) {
        return res.status(400).json({ success: false, message: check.message });
      }
    }
    userData.employeeProfile = profile;
  }

  // Issue a badge number unless this employee already carries one. It is what
  // the card's 1-D barcode encodes, so an employee without one has a card no
  // laser scanner can read — which is why it is assigned here, on creation,
  // rather than left to whoever eventually prints the badge.
  //
  // The retry redraws the number and rebuilds the payload from scratch each
  // time: `userData` must not be mutated, or a rejected number would be carried
  // into the next attempt and clash again on exactly the number that failed.
  let user;
  try {
    if (needsBadgeNumber(userData.employeeProfile)) {
      user = await assignBadgeNumber((code) =>
        User.create({
          ...userData,
          employeeProfile: withBadgeNumber(userData.employeeProfile, code),
        })
      );
    } else {
      user = await User.create(userData);
    }
  } catch (err) {
    // Only reachable for a badge the CALLER supplied — one we generated is
    // retried above. Redrawing somebody's hand-entered number would silently
    // replace what they typed, so this is a 409 for them to resolve.
    if (isDuplicateBadgeNumberError(err)) {
      return res.status(409).json({
        success: false,
        message: 'That badge number is already in use by another employee',
      });
    }
    throw err;
  }

  res.status(201).json({ success: true, data: { employee: present(user) } });
});

// ─── Update ────────────────────────────────────────────────────────────────────

exports.updateEmployee = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  // +posPinHash so the response's hasPin flag is accurate even when the PIN
  // itself isn't being changed (the field is select:false by default).
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId }).select(
    '+posPinHash'
  );
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  // Custom-role assignment. Shape + owner guards run FIRST (pure, no DB), so
  // e.g. a tenant_owner rejection never touches the Role collection. Then the
  // DB-level checks: existence and TENANT scope of THIS tenant — a platform-
  // shelf or another business's role is refused with the same message so
  // callers learn nothing about foreign ids. Clearing (null/'') skips all lookups.
  const built = buildUpdateChanges(user, req.body);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }

  if (built.changes.customRole) {
    const customRole = await Role.findById(built.changes.customRole);
    if (
      !customRole ||
      customRole.scope !== 'tenant' ||
      String(customRole.tenant) !== String(tenantId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'That custom role is not available for your organisation',
      });
    }
  }

  Object.assign(user, built.changes);

  if (built.changes.customRole !== undefined) {
    user.markModified('customRole');
  }

  // Avatar set/clear: a URL/object sets it, '' or null removes it.
  if ('avatar' in req.body) {
    user.avatar = sanitizeAvatar(req.body.avatar) || undefined;
    user.markModified('avatar');
  }

  // Full-replace the HR profile when the client sends one (the edit form always
  // submits the complete profile object).
  if ('employeeProfile' in req.body) {
    const profile = buildEmployeeProfile(req.body.employeeProfile);
    const managerId = profile.work?.manager;
    if (managerId) {
      const check = validateManagerAssignment(managerId, {
        selfId: user._id,
        managerOf: await loadManagerGraph(tenantId),
      });
      if (!check.ok) {
        return res.status(400).json({ success: false, message: check.message });
      }
    }
    // The full-replace would otherwise delete an issued badge number whenever
    // the submission omits it — and that number is on a card in somebody's
    // pocket, so losing it silently stops the card working. An explicit value
    // still wins: overwriting is how an employee moves to a pre-printed card.
    user.employeeProfile = carryOverBadgeNumber(profile, user.employeeProfile);
    user.markModified('employeeProfile');
  }

  // PIN may be set/cleared in the same request: '' or null clears it.
  if ('pin' in req.body) {
    const { pin } = req.body;
    if (pin === null || pin === '') {
      user.posPinHash = undefined;
    } else if (isValidPin(pin)) {
      user.posPinHash = await bcrypt.hash(String(pin), 10);
    } else {
      return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
    }
  }

  try {
    await user.save();
  } catch (err) {
    // A badge number the caller typed that another employee in this tenant
    // already holds. Named, because it is theirs to resolve — the per-tenant
    // unique index is what stops two cards clocking in as each other.
    if (isDuplicateBadgeNumberError(err)) {
      return res.status(409).json({
        success: false,
        message: 'That badge number is already in use by another employee',
      });
    }
    throw err;
  }
  // Refresh the projection so present() returns the {_id, name, color} shape.
  await user.populate({ path: 'customRole', select: 'name color' });
  res.json({ success: true, data: { employee: present(user) } });
});

// ─── Delete (soft) ───────────────────────────────────────────────────────────

exports.deleteEmployee = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const guard = canDeleteEmployee(user, req.user?._id);
  if (!guard.ok) {
    return res.status(403).json({ success: false, message: guard.message });
  }

  user.status = 'deleted';
  await user.save();
  res.json({ success: true, message: 'Employee removed' });
});

// ─── Issue a badge number ──────────────────────────────────────────────────────

/**
 * POST /api/employees/:id/badge-number — draw a badge number for somebody who
 * hasn't got one.
 *
 * A POST, not a PATCH of `rfidBadge`: the client does not choose the number.
 * It is a credential the kiosk matches, so a sequential or client-picked value
 * would let anybody work out a colleague's badge from their own.
 *
 * IDEMPOTENT IN THE WAY THAT MATTERS. An employee who already has a badge —
 * ours, or a business's own hand-entered `STAFF-0042` — gets that one back
 * unchanged, and `issued: false` says so. Re-drawing would invalidate a card
 * already in somebody's pocket, which is the one failure this endpoint exists
 * to prevent rather than cause. `needsBadgeNumber` is the predicate, the same
 * one create and the backfill use.
 *
 * The write goes through `assignBadgeNumber` like every other assignment path,
 * so a collision with a number another manager issued in the same moment is
 * redrawn rather than reported — the per-tenant partial index is the arbiter,
 * and the only honest way to learn a number is free is to try to write it.
 */
exports.issueBadgeNumber = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId }).select(
    '+posPinHash'
  );
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  if (!needsBadgeNumber(user.employeeProfile)) {
    return res.json({
      success: true,
      data: { employee: present(user), issued: false },
    });
  }

  // The profile is rebuilt from the STORED one on every attempt rather than
  // mutated in place: assignBadgeNumber may call this more than once, and a
  // document carrying the number the index just rejected would clash on that
  // same number for ever.
  const base = user.employeeProfile?.toObject
    ? user.employeeProfile.toObject()
    : user.employeeProfile;

  const updated = await assignBadgeNumber(async (code) => {
    const next = await User.findOneAndUpdate(
      { _id: user._id, tenant: tenantId },
      { $set: { employeeProfile: withBadgeNumber(base, code) } },
      { new: true, runValidators: true }
    ).select('+posPinHash');
    if (!next) {
      // The employee vanished between the read above and this write. Reported
      // rather than retried — redrawing would burn every attempt on a row that
      // is not there.
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }
    return next;
  });

  res.json({ success: true, data: { employee: present(updated), issued: true } });
});

// ─── Set / reset PIN ───────────────────────────────────────────────────────────

exports.setEmployeePin = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const { pin } = req.body;
  if (!isValidPin(pin)) {
    return res.status(400).json({ success: false, message: 'PIN must be 4–6 digits' });
  }

  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  user.posPinHash = await bcrypt.hash(String(pin), 10);
  await user.save();
  res.json({ success: true, message: 'PIN updated', data: { employee: present(user) } });
});

exports.clearEmployeePin = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId });
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  user.posPinHash = undefined;
  await user.save();
  res.json({ success: true, message: 'PIN cleared', data: { employee: present(user) } });
});
