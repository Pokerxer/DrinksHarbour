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
const asyncHandler = require('../utils/asyncHandler');
const {
  buildEmployeeFilter,
  buildCreatePayload,
  buildUpdateChanges,
  buildEmployeeProfile,
  canDeleteEmployee,
  isValidPin,
  sanitizeAvatar,
} = require('../services/employee.helpers');

// Fields safe to return to the client — never the password or PIN hash.
const PUBLIC_FIELDS =
  'firstName lastName email phone avatar role status posAccess posName posPermissions createdAt';

// Shape a user document into the API's Employee object. `hasPin` is derived so
// the UI can show "PIN set" without ever exposing the hash.
function present(user) {
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
    .select(`${PUBLIC_FIELDS} posPinHash`)
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
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId }).select('+posPinHash');
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
    userData.employeeProfile = buildEmployeeProfile(req.body.employeeProfile);
  }

  const user = await User.create(userData);
  res.status(201).json({ success: true, data: { employee: present(user) } });
});

// ─── Update ────────────────────────────────────────────────────────────────────

exports.updateEmployee = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  // +posPinHash so the response's hasPin flag is accurate even when the PIN
  // itself isn't being changed (the field is select:false by default).
  const user = await User.findOne({ _id: req.params.id, tenant: tenantId }).select('+posPinHash');
  if (!user || user.status === 'deleted') {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const built = buildUpdateChanges(user, req.body);
  if (!built.ok) {
    return res.status(400).json({ success: false, message: built.message });
  }
  Object.assign(user, built.changes);

  // Avatar set/clear: a URL/object sets it, '' or null removes it.
  if ('avatar' in req.body) {
    user.avatar = sanitizeAvatar(req.body.avatar) || undefined;
    user.markModified('avatar');
  }

  // Full-replace the HR profile when the client sends one (the edit form always
  // submits the complete profile object).
  if ('employeeProfile' in req.body) {
    user.employeeProfile = buildEmployeeProfile(req.body.employeeProfile);
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

  await user.save();
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
