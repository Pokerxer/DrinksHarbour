// server/controllers/shift.controller.js
//
// Shift templates and the roster they generate.
//
// Every scheduling rule — clock arithmetic, generation planning, overlap and
// eligibility — lives in services/shift.helpers.js and is unit-tested without a
// database. This file does the IO around them: tenant scoping, loading the
// context a rule needs, and turning a rule's refusal into an HTTP status.
//
// Two refusals are modelled deliberately differently:
//   400 — the request itself is malformed (bad date, missing role).
//   409 — the request is well-formed but conflicts with the world (the employee
//         is already booked, the role is not one they hold). The body carries
//         the helper's `code` and `conflicts` so the UI can name the clash
//         rather than saying "failed".

const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');

const Shift = require('../models/Shift');
const ShiftTemplate = require('../models/ShiftTemplate');
const TimeOffRequest = require('../models/TimeOffRequest');
const User = require('../models/User');

const { isObjectIdLike, describeDeleteBlockers } = require('../services/orgStructure.helpers');
const {
  SHIFT_STATUSES,
  buildShiftTemplatePayload,
  buildShiftPayload,
  validateShiftTimes,
  parseRosterRange,
  clampPublishRange,
  planShiftGeneration,
  checkAssignment,
  summariseRoster,
  canTransitionShift,
  statusesThatCanBecome,
  tenantOffsetMinutes: offsetForTenant,
} = require('../services/shift.helpers');

const DUPLICATE_KEY = 11000;

const TEMPLATE_POPULATE = [
  { path: 'role', select: 'name color' },
  { path: 'department', select: 'name color' },
];

const SHIFT_POPULATE = [
  { path: 'employee', select: 'firstName lastName email avatar' },
  { path: 'role', select: 'name color' },
  { path: 'department', select: 'name color' },
  { path: 'template', select: 'name color' },
];

/**
 * The tenant's UTC offset in minutes, off the request.
 *
 * The rule itself lives in shift.helpers.js so the roster and attendance can
 * never disagree about what time it is for a business; this is only the
 * req → tenant hop.
 */
function tenantOffsetMinutes(req) {
  return offsetForTenant(req.tenant);
}

function notFound(res, label) {
  return res.status(404).json({ success: false, message: `${label} not found` });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

/** A helper refusal ({code, message, conflicts}) as the 409 the client expects. */
function conflict(res, refusal) {
  return res.status(409).json({
    success: false,
    code: refusal.code,
    message: refusal.message,
    conflicts: refusal.conflicts || [],
  });
}

// ── Shift templates ───────────────────────────────────────────────────────────

const listTemplates = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const filter = { tenant: tenantId };

  // Tri-state, as on the org-structure lists: an absent flag means both, because
  // an admin looking for a template to reactivate has to be able to see it.
  if (req.query.isActive === 'true') filter.isActive = true;
  else if (req.query.isActive === 'false') filter.isActive = false;
  if (isObjectIdLike(req.query.department)) filter.department = req.query.department;
  if (isObjectIdLike(req.query.role)) filter.role = req.query.role;

  const [rows, counts] = await Promise.all([
    ShiftTemplate.find(filter).populate(TEMPLATE_POPULATE).sort({ name: 1 }).lean(),
    // Upcoming shifts per template, in ONE aggregate — a per-row count would be
    // a query per template on a page that lists every template. Past shifts are
    // excluded: the number an admin acts on is what deleting would strand.
    Shift.aggregate([
      {
        $match: {
          tenant: new mongoose.Types.ObjectId(String(tenantId)),
          template: { $ne: null },
          status: { $ne: 'cancelled' },
          start: { $gte: new Date() },
        },
      },
      { $group: { _id: '$template', count: { $sum: 1 } } },
    ]),
  ]);

  const byTemplate = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({
    success: true,
    data: {
      items: rows.map((r) => ({ ...r, shiftCount: byTemplate.get(String(r._id)) || 0 })),
    },
  });
});

const getTemplate = asyncHandler(async (req, res) => {
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift template');
  const item = await ShiftTemplate.findOne({ _id: req.params.id, tenant: req.tenant?._id })
    .populate(TEMPLATE_POPULATE)
    .lean();
  if (!item) return notFound(res, 'Shift template');
  res.json({ success: true, data: { item } });
});

const createTemplate = asyncHandler(async (req, res) => {
  const built = buildShiftTemplatePayload(req.body, { isUpdate: false });
  if (!built.ok) return badRequest(res, built.message);

  try {
    const row = await ShiftTemplate.create({
      ...built.value,
      tenant: req.tenant?._id,
      createdBy: req.user?._id,
    });
    const item = await ShiftTemplate.findById(row._id).populate(TEMPLATE_POPULATE).lean();
    res.status(201).json({ success: true, data: { item } });
  } catch (err) {
    if (err?.code === DUPLICATE_KEY) {
      return res
        .status(409)
        .json({ success: false, message: 'A shift template with that name already exists' });
    }
    throw err;
  }
});

const updateTemplate = asyncHandler(async (req, res) => {
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift template');
  const row = await ShiftTemplate.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!row) return notFound(res, 'Shift template');

  const built = buildShiftTemplatePayload(req.body, { isUpdate: true });
  if (!built.ok) return badRequest(res, built.message);

  Object.assign(row, built.value);
  try {
    await row.save();
  } catch (err) {
    if (err?.code === DUPLICATE_KEY) {
      return res
        .status(409)
        .json({ success: false, message: 'A shift template with that name already exists' });
    }
    throw err;
  }

  const item = await ShiftTemplate.findById(row._id).populate(TEMPLATE_POPULATE).lean();
  res.json({ success: true, data: { item } });
});

const deleteTemplate = asyncHandler(async (req, res) => {
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift template');
  const tenantId = req.tenant?._id;
  const row = await ShiftTemplate.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Shift template');

  // Only shifts still ahead of us block: a template is history for past shifts,
  // and refusing forever would make templates undeletable after a month's use.
  const shifts = await Shift.countDocuments({
    tenant: tenantId,
    template: row._id,
    status: { $ne: 'cancelled' },
    start: { $gte: new Date() },
  });
  const guard = describeDeleteBlockers({ shifts });
  if (!guard.ok) return res.status(409).json({ success: false, message: guard.message });

  await row.deleteOne();
  res.json({ success: true, message: 'Shift template deleted' });
});

// ── Roster ────────────────────────────────────────────────────────────────────

/**
 * Load everything `checkAssignment` needs to judge one assignment.
 *
 * Every clause here is a NARROWING, not a rule. The DB fetches anything near
 * the window and `findOverlaps` / `overlapsTimeOff` decide, so the half-open
 * `[start, end)` comparison and the approved-only test each live in exactly one
 * place — `status: 'approved'` appears in the time-off query only to avoid
 * dragging a year of rejected requests across the wire, and the helper checks
 * it again anyway.
 *
 * Exported because approving a shift swap is an assignment like any other and
 * has to be judged by the same context; a second loader would be a second set
 * of rules the moment one of them learned something.
 */
async function assignmentContext(tenantId, employeeId, window, excludeId) {
  const [employee, shifts, timeOff] = await Promise.all([
    User.findOne({ _id: employeeId, tenant: tenantId, status: { $ne: 'deleted' } })
      .select('firstName lastName status employeeProfile.planning.roles')
      .lean(),
    Shift.find({
      tenant: tenantId,
      employee: employeeId,
      status: { $ne: 'cancelled' },
      start: { $lt: window.end },
      end: { $gt: window.start },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id employee start end status')
      .lean(),
    TimeOffRequest.find({
      tenant: tenantId,
      employee: employeeId,
      status: 'approved',
      startDate: { $lt: window.end },
      endDate: { $gt: window.start },
    })
      .select('_id employee type status startDate endDate halfDay days')
      .lean(),
  ]);
  return { employee, shifts, timeOff };
}

const listShifts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const range = parseRosterRange(req.query, tenantOffsetMinutes(req));
  if (!range.ok) return badRequest(res, range.message);

  const filter = { tenant: tenantId, start: { $gte: range.start, $lt: range.end } };
  if (isObjectIdLike(req.query.department)) filter.department = req.query.department;
  if (isObjectIdLike(req.query.role)) filter.role = req.query.role;
  if (isObjectIdLike(req.query.employee)) filter.employee = req.query.employee;
  // `?employee=open` is the open-shift lane, which is a null ref rather than an
  // id — the one filter value that cannot be expressed as an ObjectId.
  else if (req.query.employee === 'open') filter.employee = null;
  if (SHIFT_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const items = await Shift.find(filter).populate(SHIFT_POPULATE).sort({ start: 1 }).lean();

  res.json({
    success: true,
    data: {
      items,
      summary: summariseRoster(items),
      range: { from: range.from, to: range.to },
    },
  });
});

const createShift = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const built = buildShiftPayload(req.body, { isUpdate: false });
  if (!built.ok) return badRequest(res, built.message);

  const times = validateShiftTimes(built.value.start, built.value.end);
  if (!times.ok) return badRequest(res, times.message);

  let warnings = [];
  if (built.value.employee) {
    const ctx = await assignmentContext(tenantId, built.value.employee, built.value, null);
    const verdict = checkAssignment(built.value, ctx.employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
      force: Boolean(req.body.force),
    });
    if (!verdict.ok) return conflict(res, verdict);
    warnings = verdict.warnings;
  }

  const row = await Shift.create({
    ...built.value,
    tenant: tenantId,
    // Never published on creation: a roster becomes visible to staff through
    // the publish action alone, so adding a shift cannot leak a draft week.
    status: 'draft',
    createdBy: req.user?._id,
  });

  const item = await Shift.findById(row._id).populate(SHIFT_POPULATE).lean();
  res.status(201).json({ success: true, data: { item, warnings } });
});

const updateShift = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift');

  const row = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Shift');

  const built = buildShiftPayload(req.body, { isUpdate: true });
  if (!built.ok) return badRequest(res, built.message);

  // Status is not an ordinary field: every move goes through the transition
  // table, so an edit can never quietly un-cancel or re-draft a published shift.
  let nextStatus = null;
  if (req.body.status !== undefined && req.body.status !== row.status) {
    if (!SHIFT_STATUSES.includes(req.body.status)) {
      return badRequest(res, `Status must be one of: ${SHIFT_STATUSES.join(', ')}`);
    }
    if (!canTransitionShift(row.status, req.body.status)) {
      return badRequest(res, `A ${row.status} shift cannot become ${req.body.status}`);
    }
    nextStatus = req.body.status;
  }

  const start = built.value.start ?? row.start;
  const end = built.value.end ?? row.end;
  const times = validateShiftTimes(start, end);
  if (!times.ok) return badRequest(res, times.message);

  const employee =
    built.value.employee !== undefined ? built.value.employee : row.employee && String(row.employee);

  let warnings = [];
  // Re-checked whenever the person or the window moves. A cancelled shift is
  // exempt: it occupies nobody's time, so holding an edit to it against an
  // overlap would block the one action that clears the clash.
  const rechecked =
    built.value.employee !== undefined ||
    built.value.start !== undefined ||
    built.value.end !== undefined;

  if (employee && rechecked && (nextStatus ?? row.status) !== 'cancelled') {
    const candidate = { role: built.value.role ?? row.role, start, end, _id: row._id };
    const ctx = await assignmentContext(tenantId, employee, { start, end }, row._id);
    const verdict = checkAssignment(candidate, ctx.employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
      force: Boolean(req.body.force),
    });
    if (!verdict.ok) return conflict(res, verdict);
    warnings = verdict.warnings;
  }

  Object.assign(row, built.value);
  if (nextStatus) {
    row.status = nextStatus;
    if (nextStatus === 'published' && !row.publishedAt) row.publishedAt = new Date();
  }
  await row.save();

  const item = await Shift.findById(row._id).populate(SHIFT_POPULATE).lean();
  res.json({ success: true, data: { item, warnings } });
});

const deleteShift = asyncHandler(async (req, res) => {
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift');
  const row = await Shift.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!row) return notFound(res, 'Shift');

  // A published shift has been seen by whoever was rostered on it. Deleting it
  // would make it vanish with no trace; cancelling leaves a record they can be
  // told about. Drafts nobody has seen are safe to remove outright.
  if (row.status !== 'draft') {
    return res.status(409).json({
      success: false,
      code: 'not_draft',
      message: 'Only a draft shift can be deleted. Cancel this one instead.',
    });
  }

  await row.deleteOne();
  res.json({ success: true, message: 'Shift deleted' });
});

const generateShifts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);
  const range = parseRosterRange(req.body, offsetMinutes);
  if (!range.ok) return badRequest(res, range.message);

  const ids = Array.isArray(req.body.templateIds) ? req.body.templateIds.filter(isObjectIdLike) : [];
  if (!ids.length) return badRequest(res, 'Choose at least one template to generate from');

  const templates = await ShiftTemplate.find({ tenant: tenantId, _id: { $in: ids } }).lean();
  if (!templates.length) return badRequest(res, 'None of those templates exist in your organisation');

  // Only shifts already generated from these templates matter: the planner keys
  // idempotency on (template, start), and an unrelated hand-made shift at the
  // same time is a legitimate second slot, not a duplicate.
  const existing = await Shift.find({
    tenant: tenantId,
    template: { $in: templates.map((t) => t._id) },
    start: { $gte: range.start, $lt: range.end },
  })
    .select('_id template start status')
    .lean();

  const { toCreate, skipped } = planShiftGeneration(templates, {
    from: range.from,
    to: range.to,
    offsetMinutes,
    existing,
  });

  // `date` is the planner's own bookkeeping — the instant is already in start.
  const docs = toCreate.map(({ date, ...s }) => ({
    ...s,
    tenant: tenantId,
    createdBy: req.user?._id,
  }));

  const created = docs.length ? await Shift.insertMany(docs) : [];

  // `skipped` is returned in full and never swallowed. "Generated 0 shifts" with
  // no reason is indistinguishable from a broken feature; the reasons are what
  // tell an admin their template has no days set or the week is already built.
  res.status(201).json({
    success: true,
    data: {
      created: created.length,
      items: created.map((d) => d.toObject()),
      skipped,
    },
  });
});

/**
 * POST /api/shifts/publish — make a stretch of the roster visible to staff.
 *
 * NEVER REACHES INTO THE PAST. Publishing is what staff can see, and attendance
 * counts a published shift with no punch against it as an absence — so
 * publishing last week marks people absent for shifts they were never shown,
 * on a day they can no longer do anything about. The floor is the start of
 * today, and it lives in clampPublishRange where it is tested.
 *
 * What was held back is REPORTED rather than quietly dropped. "Published 3" on
 * a fortnight the manager selected is indistinguishable from a broken button;
 * the same reasoning as `skipped` on generation, a few functions above.
 */
const publishShifts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);
  const asked = parseRosterRange(req.body, offsetMinutes);
  if (!asked.ok) return badRequest(res, asked.message);

  const range = clampPublishRange(asked, offsetMinutes);
  if (!range.ok) return badRequest(res, range.message);

  // Derived from the transition table rather than hard-coding `draft`, so the
  // bulk move and the single-shift move can never disagree about what is legal.
  const publishable = statusesThatCanBecome('published');

  // Counted BEFORE the write, and only when the range was actually clamped: it
  // is the number the manager is owed an explanation for. These stay drafts.
  const heldBack = range.clamped
    ? await Shift.countDocuments({
        tenant: tenantId,
        status: { $in: publishable },
        start: { $gte: asked.start, $lt: range.start },
      })
    : 0;

  const result = await Shift.updateMany(
    {
      tenant: tenantId,
      status: { $in: publishable },
      start: { $gte: range.start, $lt: range.end },
    },
    { $set: { status: 'published', publishedAt: new Date() } }
  );

  res.json({
    success: true,
    data: {
      published: result.modifiedCount ?? 0,
      // Named for what it is from the manager's side: shifts they asked to
      // publish that are still drafts, and why.
      heldBack,
      clamped: range.clamped,
      range: { from: range.from, to: range.to },
    },
  });
});

module.exports = {
  // Shared with the swap controller: approving a swap is an assignment, and it
  // is judged by exactly this context.
  assignmentContext,
  templates: {
    list: listTemplates,
    getOne: getTemplate,
    create: createTemplate,
    update: updateTemplate,
    remove: deleteTemplate,
  },
  shifts: {
    list: listShifts,
    create: createShift,
    update: updateShift,
    remove: deleteShift,
    generate: generateShifts,
    publish: publishShifts,
  },
};
