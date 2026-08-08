// server/controllers/orgStructure.controller.js
//
// CRUD for the tenant org structure: departments, job positions and HR/planning
// employee roles. The three entities differ only in their payload validation,
// how employees reference them, and what blocks a delete — so the handlers are
// generated once from a per-entity descriptor rather than written three times.
//
// Every query is scoped to req.tenant._id. All validation lives in
// services/orgStructure.helpers.js, which is unit-tested without a database.

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');

const Department = require('../models/Department');
const JobPosition = require('../models/JobPosition');
const EmployeeRole = require('../models/EmployeeRole');
const Shift = require('../models/Shift');
const ShiftTemplate = require('../models/ShiftTemplate');
const User = require('../models/User');

const {
  buildOrgFilter,
  buildDepartmentPayload,
  buildJobPositionPayload,
  buildEmployeeRolePayload,
  validateParentAssignment,
  describeDeleteBlockers,
  isObjectIdLike,
} = require('../services/orgStructure.helpers');

// Employees, for counting purposes, excludes soft-deleted accounts — a deleted
// employee must not keep a department alive nor inflate its headcount.
const LIVE_EMPLOYEE = { status: { $ne: 'deleted' } };

/**
 * Count live employees per referenced org entity, in ONE aggregate.
 *
 * A per-row count would be a query per department on a page that already lists
 * every department; this returns the whole map in a single round trip.
 *
 * @param {*} tenantId
 * @param {string} path   - the employeeProfile path holding the ref
 * @param {boolean} isArray - true for planning.roles, which is a list
 * @returns {Promise<Map<string, number>>} entityId → employee count
 */
async function countEmployeesByRef(tenantId, path, isArray = false) {
  const pipeline = [
    { $match: { tenant: new mongoose.Types.ObjectId(String(tenantId)), ...LIVE_EMPLOYEE } },
  ];
  if (isArray) pipeline.push({ $unwind: `$${path}` });
  pipeline.push(
    { $match: { [path]: { $ne: null } } },
    { $group: { _id: `$${path}`, count: { $sum: 1 } } }
  );

  const rows = await User.aggregate(pipeline);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// ── Entity descriptors ────────────────────────────────────────────────────────

const ENTITIES = {
  departments: {
    Model: Department,
    label: 'Department',
    buildPayload: buildDepartmentPayload,
    employeePath: 'employeeProfile.work.department',
    populate: [
      { path: 'manager', select: 'firstName lastName email avatar' },
      { path: 'parent', select: 'name' },
    ],
    sort: { name: 1 },
    /**
     * A department is held open by its staff, its posts, and its children —
     * deleting one while any of those point at it would leave dangling refs on
     * documents that render without guarding for null.
     */
    async countBlockers(tenantId, id) {
      const [employees, positions, children] = await Promise.all([
        User.countDocuments({ tenant: tenantId, 'employeeProfile.work.department': id, ...LIVE_EMPLOYEE }),
        JobPosition.countDocuments({ tenant: tenantId, department: id }),
        Department.countDocuments({ tenant: tenantId, parent: id }),
      ]);
      return { employees, positions, children };
    },
  },

  'job-positions': {
    Model: JobPosition,
    label: 'Job position',
    buildPayload: buildJobPositionPayload,
    employeePath: 'employeeProfile.work.jobPosition',
    populate: [{ path: 'department', select: 'name color' }],
    sort: { name: 1 },
    async countBlockers(tenantId, id) {
      const employees = await User.countDocuments({
        tenant: tenantId,
        'employeeProfile.work.jobPosition': id,
        ...LIVE_EMPLOYEE,
      });
      return { employees };
    },
  },

  'employee-roles': {
    Model: EmployeeRole,
    label: 'Role',
    buildPayload: buildEmployeeRolePayload,
    // An array path: an employee may hold several planning roles.
    employeePath: 'employeeProfile.planning.roles',
    employeePathIsArray: true,
    populate: [],
    sort: { name: 1 },
    async countBlockers(tenantId, id) {
      // Either membership in the roles list or being someone's default role
      // counts — clearing only one of the two still leaves a dangling ref.
      //
      // The roster holds a role open too. Only shifts still ahead of us block:
      // a past shift is history and refusing on it would make a role that has
      // ever been worked permanently undeletable. A template blocks whatever its
      // date, because it has no date — it would go on generating shifts whose
      // required role no longer exists.
      const [employees, templates, shifts] = await Promise.all([
        User.countDocuments({
          tenant: tenantId,
          ...LIVE_EMPLOYEE,
          $or: [
            { 'employeeProfile.planning.roles': id },
            { 'employeeProfile.planning.defaultRole': id },
          ],
        }),
        ShiftTemplate.countDocuments({ tenant: tenantId, role: id }),
        Shift.countDocuments({
          tenant: tenantId,
          role: id,
          status: { $ne: 'cancelled' },
          start: { $gte: new Date() },
        }),
      ]);
      return { employees, templates, shifts };
    },
  },
};

// Mongo duplicate-key. Surfaced as a 409 with the entity's own wording rather
// than the raw driver error, which names the index and leaks the schema.
const DUPLICATE_KEY = 11000;

function notFound(res, label) {
  return res.status(404).json({ success: false, message: `${label} not found` });
}

// ── Handler factory ───────────────────────────────────────────────────────────

/**
 * Build the five CRUD handlers for one org entity.
 * @param {string} key - a key of ENTITIES
 */
function makeHandlers(key) {
  const entity = ENTITIES[key];
  const { Model, label, buildPayload, employeePath, employeePathIsArray, populate, sort } = entity;

  const list = asyncHandler(async (req, res) => {
    const tenantId = req.tenant?._id;
    const filter = buildOrgFilter(tenantId, {
      search: req.query.search,
      isActive: req.query.isActive,
      department: req.query.department,
    });

    const [rows, counts] = await Promise.all([
      Model.find(filter).populate(populate).sort(sort).lean(),
      countEmployeesByRef(tenantId, employeePath, employeePathIsArray),
    ]);

    res.json({
      success: true,
      data: {
        items: rows.map((r) => ({ ...r, employeeCount: counts.get(String(r._id)) || 0 })),
      },
    });
  });

  const getOne = asyncHandler(async (req, res) => {
    const tenantId = req.tenant?._id;
    if (!isObjectIdLike(req.params.id)) return notFound(res, label);

    const row = await Model.findOne({ _id: req.params.id, tenant: tenantId })
      .populate(populate)
      .lean();
    if (!row) return notFound(res, label);

    const counts = await countEmployeesByRef(tenantId, employeePath, employeePathIsArray);
    res.json({
      success: true,
      data: { item: { ...row, employeeCount: counts.get(String(row._id)) || 0 } },
    });
  });

  const create = asyncHandler(async (req, res) => {
    const tenantId = req.tenant?._id;
    const built = buildPayload(req.body, { isUpdate: false });
    if (!built.ok) return res.status(400).json({ success: false, message: built.message });

    if (key === 'departments' && built.value.parent) {
      const check = validateParentAssignment(built.value.parent, {
        selfId: null,
        parentOf: await loadParentGraph(tenantId),
      });
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }

    try {
      const row = await Model.create({
        ...built.value,
        tenant: tenantId,
        createdBy: req.user?._id,
      });
      res.status(201).json({ success: true, data: { item: row.toObject() } });
    } catch (err) {
      if (err?.code === DUPLICATE_KEY) {
        return res
          .status(409)
          .json({ success: false, message: `A ${label.toLowerCase()} with that name already exists` });
      }
      throw err;
    }
  });

  const update = asyncHandler(async (req, res) => {
    const tenantId = req.tenant?._id;
    if (!isObjectIdLike(req.params.id)) return notFound(res, label);

    const row = await Model.findOne({ _id: req.params.id, tenant: tenantId });
    if (!row) return notFound(res, label);

    const built = buildPayload(req.body, { isUpdate: true });
    if (!built.ok) return res.status(400).json({ success: false, message: built.message });

    if (key === 'departments' && built.value.parent) {
      const check = validateParentAssignment(built.value.parent, {
        selfId: row._id,
        parentOf: await loadParentGraph(tenantId),
      });
      if (!check.ok) return res.status(400).json({ success: false, message: check.message });
    }

    Object.assign(row, built.value);
    try {
      await row.save();
    } catch (err) {
      if (err?.code === DUPLICATE_KEY) {
        return res
          .status(409)
          .json({ success: false, message: `A ${label.toLowerCase()} with that name already exists` });
      }
      throw err;
    }

    const fresh = await Model.findById(row._id).populate(populate).lean();
    res.json({ success: true, data: { item: fresh } });
  });

  const remove = asyncHandler(async (req, res) => {
    const tenantId = req.tenant?._id;
    if (!isObjectIdLike(req.params.id)) return notFound(res, label);

    const row = await Model.findOne({ _id: req.params.id, tenant: tenantId });
    if (!row) return notFound(res, label);

    const guard = describeDeleteBlockers(await entity.countBlockers(tenantId, row._id));
    if (!guard.ok) return res.status(409).json({ success: false, message: guard.message });

    await row.deleteOne();
    res.json({ success: true, message: `${label} deleted` });
  });

  return { list, getOne, create, update, remove };
}

/**
 * departmentId → its current parentId ('' when none), for every department in
 * the tenant. Feeds validateParentAssignment's cycle walk.
 */
async function loadParentGraph(tenantId) {
  const rows = await Department.find({ tenant: tenantId }).select('_id parent').lean();
  return new Map(rows.map((d) => [String(d._id), d.parent ? String(d.parent) : '']));
}

module.exports = {
  departments: makeHandlers('departments'),
  jobPositions: makeHandlers('job-positions'),
  employeeRoles: makeHandlers('employee-roles'),
};
