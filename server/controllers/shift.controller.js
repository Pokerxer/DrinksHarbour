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
const { buildEmployeeFilter } = require('../services/employee.helpers');
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
  judgeAssignments,
  bindEditedAssignment,
  groupAssignmentContexts,
  planPatternFill,
  fillContextWindow,
  eachDateInRange,
  patternDates,
  MAX_FILL_ROWS,
} = require('../services/shift.helpers');

const DUPLICATE_KEY = 11000;

const TEMPLATE_POPULATE = [
  { path: 'role', select: 'name color' },
  { path: 'department', select: 'name color' },
  { path: 'positions.roles', select: 'name color' },
];

const SHIFT_POPULATE = [
  { path: 'employee', select: 'firstName lastName email avatar' },
  { path: 'role', select: 'name color' },
  { path: 'altRoles', select: 'name color' },
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

/** An employee doc trimmed to what a conflict line needs to name a person. */
function personRef(employee) {
  if (!employee) return null;
  return {
    _id: employee._id,
    firstName: employee.firstName,
    lastName: employee.lastName,
  };
}

/**
 * Several refusals at once, as the 409 the multi-select picker expects.
 *
 * Deliberately a DIFFERENT body from `conflict()`: this shape is only ever sent
 * for a request that carried `employees`, so a client that still posts a single
 * `employee` sees exactly the 409 it always saw.
 */
function assignmentConflict(res, { allowed, blocked }) {
  const total = allowed.length + blocked.length;
  return res.status(409).json({
    success: false,
    code: 'assignment_conflicts',
    message:
      blocked.length === total
        ? 'Nobody selected can be scheduled for that slot'
        : `${blocked.length} of ${total} people cannot be scheduled`,
    blocked: blocked.map((b) => ({
      employee: personRef(b.employee),
      code: b.code,
      message: b.message,
      conflicts: b.conflicts,
      forceable: b.forceable,
      // Set by the caller, never decided here: `updateShift`'s fan-out edit is
      // the only place a refusal can be PINNED — attached to the person going
      // onto the row already being edited, as opposed to one of the newcomers.
      // Absent (falsy) everywhere else, including every blocked entry out of
      // `createShift`'s fan-out, where nobody is pinned because there is no
      // row being kept.
      pinned: Boolean(b.pinned),
    })),
    allowed: allowed.map((a) => ({
      employee: personRef(a.employee),
      warnings: a.warnings,
    })),
  });
}

/**
 * The `employees` fan-out list off a request body.
 *
 * `{ ok: true, ids: null }` means the field was ABSENT — the caller keeps the
 * original single-or-open path untouched, 409 shape included.
 *
 * On create an empty list is a 400: an open shift is expressed by omitting
 * `employees` and sending `employee: null`, so a null never has to survive a
 * round trip inside a list. On update an empty list is legal and means "unassign
 * this row", which is `allowEmpty`.
 */
function readFanOut(body = {}, { allowEmpty = false } = {}) {
  if (body.employees === undefined) return { ok: true, ids: null };
  if (!Array.isArray(body.employees)) {
    return { ok: false, message: 'employees must be a list of employee ids' };
  }
  if (!body.employees.length) {
    return allowEmpty
      ? { ok: true, ids: [] }
      : { ok: false, message: 'Choose at least one person, or leave the shift open' };
  }
  if (!body.employees.every(isObjectIdLike)) {
    return { ok: false, message: 'employees must be a list of employee ids' };
  }

  const ids = [];
  for (const id of body.employees) {
    const s = String(id);
    if (!ids.includes(s)) ids.push(s);
  }
  return { ok: true, ids };
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

  // Positions carry the generation idempotency handle (see `keyOf` in
  // shift.helpers.js), so an edit must keep the _id of a position that is
  // still recognisably the SAME one. Matching is by IDENTITY, never by array
  // index: removing a non-trailing position shifts every index after it, and
  // an index match would silently re-stamp a surviving position with a
  // removed one's _id — corrupting its generation count instead of the
  // removed position's. `built.value.positions` was already validated by
  // buildShiftTemplatePayload, which preserves any `_id` the body sent (or
  // rejects a malformed one); here that _id is trusted only if it still names
  // a position on the CURRENTLY STORED template (`row`, loaded above and not
  // yet mutated) — an unrecognised _id is dropped so a caller cannot graft
  // another template's position onto this one, and Mongoose mints a fresh one
  // for it instead.
  if (built.value.positions) {
    const currentIds = new Set((row.positions || []).map((p) => String(p._id)));
    built.value.positions = built.value.positions.map((p) => {
      if (p._id && currentIds.has(String(p._id))) return p;
      const { _id, ...rest } = p;
      return rest;
    });
  }

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
async function assignmentContexts(tenantId, employeeIds = [], window, excludeId) {
  const ids = employeeIds.map(String).filter(isObjectIdLike);
  if (!ids.length) return new Map();

  const [employees, shifts, timeOff] = await Promise.all([
    User.find({ _id: { $in: ids }, tenant: tenantId, status: { $ne: 'deleted' } })
      .select('firstName lastName status employeeProfile.planning.roles')
      .lean(),
    Shift.find({
      tenant: tenantId,
      employee: { $in: ids },
      status: { $ne: 'cancelled' },
      start: { $lt: window.end },
      end: { $gt: window.start },
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id employee start end status')
      .lean(),
    TimeOffRequest.find({
      tenant: tenantId,
      employee: { $in: ids },
      status: 'approved',
      startDate: { $lt: window.end },
      endDate: { $gt: window.start },
    })
      .select('_id employee type status startDate endDate halfDay days')
      .lean(),
  ]);

  return groupAssignmentContexts(employees, shifts, timeOff);
}

/**
 * One employee's context, in the shape `checkAssignment` takes.
 *
 * A thin call into the plural version so there is ONE set of queries. Shift-swap
 * approval imports this, and a second loader would become a second set of rules
 * the moment one of them learned something.
 */
async function assignmentContext(tenantId, employeeId, window, excludeId) {
  const byId = await assignmentContexts(tenantId, [employeeId], window, excludeId);
  const entry = byId.get(String(employeeId));
  return {
    employee: entry?.employee ?? null,
    shifts: entry?.shifts ?? [],
    timeOff: entry?.timeOff ?? [],
  };
}

const listShifts = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const range = parseRosterRange(req.query, tenantOffsetMinutes(req));
  if (!range.ok) return badRequest(res, range.message);

  const filter = { tenant: tenantId, start: { $gte: range.start, $lt: range.end } };
  if (isObjectIdLike(req.query.department)) filter.department = req.query.department;
  // "Show me the server shifts" must find a shift that accepts server as an
  // alternative, not only one where server is the primary.
  if (isObjectIdLike(req.query.role)) {
    filter.$or = [{ role: req.query.role }, { altRoles: req.query.role }];
  }
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

  const fan = readFanOut(req.body);
  if (!fan.ok) return badRequest(res, fan.message);

  // No `employees` field: the original single-or-open path, byte for byte.
  if (fan.ids === null) {
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
    return res.status(201).json({ success: true, data: { item, warnings } });
  }

  // The fan-out: N ticked people become N rows, one each, so every downstream
  // reader — attendance's punch→shift match, swaps, the roster lanes — still
  // sees exactly one person per shift.
  const byId = await assignmentContexts(tenantId, fan.ids, built.value, null);
  const candidates = fan.ids.map((id) => byId.get(id)?.employee ?? null);
  const { allowed, blocked } = judgeAssignments(built.value, candidates, byId, {
    force: Boolean(req.body.force),
  });

  // All-or-nothing unless the admin explicitly chose to skip. Nothing is written
  // until they do, so a save never half-happens behind their back.
  if (blocked.length && (!req.body.skipBlocked || !allowed.length)) {
    return assignmentConflict(res, { allowed, blocked });
  }

  const rows = await Shift.insertMany(
    allowed.map((a) => ({
      ...built.value,
      employee: a.employee._id,
      tenant: tenantId,
      status: 'draft',
      createdBy: req.user?._id,
    }))
  );

  const items = await Shift.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate(SHIFT_POPULATE)
    .sort({ start: 1 })
    .lean();

  res.status(201).json({
    success: true,
    data: {
      items,
      // Named per person: a forced assignment has to say WHO it was forced for,
      // or three warnings for five people mean nothing.
      warnings: allowed.flatMap((a) =>
        a.warnings.map((w) => ({ ...w, employee: personRef(a.employee) }))
      ),
      skipped: blocked.map((b) => ({
        employee: personRef(b.employee),
        code: b.code,
        message: b.message,
      })),
    },
  });
});

/**
 * Move a row onto a new status, stamping `publishedAt` the one time it
 * matters.
 *
 * Both `updateShift` edit paths — the fan-out and the back-compat single-row
 * path — need exactly this rule, so it lives here once rather than as two
 * copies of the same four lines quietly drifting apart. `publishedAt` is set
 * only the FIRST time a row becomes published: a later edit that leaves it
 * published must not restamp the moment staff were told.
 */
function applyStatusTransition(row, nextStatus) {
  if (!nextStatus) return;
  row.status = nextStatus;
  if (nextStatus === 'published' && !row.publishedAt) row.publishedAt = new Date();
}

const updateShift = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Shift');

  const row = await Shift.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Shift');

  const built = buildShiftPayload(req.body, { isUpdate: true });
  if (!built.ok) return badRequest(res, built.message);

  const fan = readFanOut(req.body, { allowEmpty: true });
  if (!fan.ok) return badRequest(res, fan.message);

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

  // A cancelled shift is exempt from every assignment check: it occupies
  // nobody's time, so holding an edit to it against an overlap would block the
  // one action that clears the clash.
  const live = (nextStatus ?? row.status) !== 'cancelled';
  const rechecked =
    built.value.employee !== undefined ||
    built.value.start !== undefined ||
    built.value.end !== undefined;

  if (fan.ids !== null) {
    // ── The fan-out edit ─────────────────────────────────────────────────────
    // The edited row keeps its identity and the newcomers get rows of their own.
    const bind = bindEditedAssignment(row.employee, fan.ids);
    const candidate = { role: built.value.role ?? row.role, start, end };

    // `excludeId` drops the row being edited from EVERY candidate's overlap
    // query. Only the person who currently holds it could ever match it, and for
    // them the exclusion is exactly right — a shift never conflicts with itself.
    const wanted = (bind.keep ? [bind.keep] : []).concat(bind.create);
    const byId = await assignmentContexts(tenantId, wanted, { start, end }, row._id);

    // The kept person is only re-judged when something that matters moved,
    // matching today's behaviour: editing a note on a forced assignment must not
    // re-raise the refusal that was already waved through.
    const keepChanged = String(bind.keep ?? '') !== String(row.employee ?? '');
    const judgeKeep = Boolean(bind.keep) && live && (keepChanged || rechecked);

    const keepVerdict = judgeKeep
      ? judgeAssignments(
          { ...candidate, _id: row._id },
          [byId.get(bind.keep)?.employee ?? null],
          byId,
          { force: Boolean(req.body.force) }
        )
      : { allowed: [], blocked: [] };

    const newVerdict = live
      ? judgeAssignments(
          candidate,
          bind.create.map((id) => byId.get(id)?.employee ?? null),
          byId,
          { force: Boolean(req.body.force) }
        )
      : { allowed: [], blocked: [] };

    const allowed = keepVerdict.allowed.concat(newVerdict.allowed);
    // `pinned` tells the client which of two 409s it is looking at. Both are
    // the SAME `assignment_conflicts` shape, so without a flag the client
    // cannot tell "these newcomers failed, skip them" (retryable) apart from
    // "the person going onto the row you're editing failed" (not retryable —
    // `skipBlocked` never skips the kept person, see below, so a client that
    // could not tell the two apart would offer a skip button that is refused
    // again, byte for byte, every time it is pressed).
    const blocked = keepVerdict.blocked
      .map((b) => ({ ...b, pinned: true }))
      .concat(newVerdict.blocked.map((b) => ({ ...b, pinned: false })));

    // `skipBlocked` only ever skips NEW rows. If the person going ON the edited
    // row is refused, that IS the edit that was asked for — silently leaving the
    // row as it was would be a different action from the one requested.
    if (keepVerdict.blocked.length) return assignmentConflict(res, { allowed, blocked });
    if (newVerdict.blocked.length && !req.body.skipBlocked) {
      return assignmentConflict(res, { allowed, blocked });
    }

    // The edited row's reassignment and the new rows it spins off are ONE
    // logical write — the whole design promises all-or-nothing. Without a
    // shared transaction, `insertMany` failing after the row's `save()` had
    // already committed would leave the edited row reassigned (and maybe
    // published) with none of the new rows to show for it, and nothing to
    // roll it back.
    //
    // `withTransaction` retries its WHOLE callback on a transient error, so
    // the row is re-read inside the session on every attempt instead of
    // reusing the `row` fetched before the transaction started — mutating
    // that outer document in place would carry an aborted attempt's changes
    // into the retry and compound them (e.g. a second `Object.assign` of the
    // same fields is harmless, but `publishedAt` must still be judged against
    // what is actually persisted, not against an in-memory leftover). Nothing
    // here is pushed into an outer array either, only assigned, so a retry
    // overwrites rather than doubles.
    const session = await mongoose.startSession();
    let savedRowId = null;
    let insertedIds = [];
    try {
      await session.withTransaction(async () => {
        const target = await Shift.findOne({ _id: row._id, tenant: tenantId }).session(session);
        Object.assign(target, built.value);
        // null = back to an open shift, waiting to be filled.
        target.employee = bind.keep;
        applyStatusTransition(target, nextStatus);
        await target.save({ session });
        savedRowId = target._id;

        // The new rows are always drafts, even when the row being edited is
        // already published: creation never publishes, so an edit cannot leak
        // a shift to staff who have not been told about it.
        insertedIds = [];
        if (newVerdict.allowed.length) {
          const inserted = await Shift.insertMany(
            newVerdict.allowed.map((a) => ({
              employee: a.employee._id,
              role: built.value.role ?? target.role,
              department: target.department,
              start,
              end,
              breakMinutes: built.value.breakMinutes ?? target.breakMinutes,
              note: built.value.note ?? target.note,
              tenant: tenantId,
              status: 'draft',
              createdBy: req.user?._id,
            })),
            { session }
          );
          insertedIds = inserted.map((r) => r._id);
        }
      });
    } finally {
      session.endSession();
    }

    // Read back AFTER commit, not inside the transaction — a read reflecting
    // an attempt the transaction later discarded would answer the request
    // with data that was never actually saved.
    const [item, created] = await Promise.all([
      Shift.findById(savedRowId).populate(SHIFT_POPULATE).lean(),
      Shift.find({ _id: { $in: insertedIds } })
        .populate(SHIFT_POPULATE)
        .sort({ start: 1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        item,
        created,
        warnings: allowed.flatMap((a) =>
          a.warnings.map((w) => ({ ...w, employee: personRef(a.employee) }))
        ),
        skipped: newVerdict.blocked.map((b) => ({
          employee: personRef(b.employee),
          code: b.code,
          message: b.message,
        })),
      },
    });
  }

  // ── The original single-or-open edit, unchanged ────────────────────────────
  const employee =
    built.value.employee !== undefined ? built.value.employee : row.employee && String(row.employee);

  let warnings = [];
  if (employee && rechecked && live) {
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
  applyStatusTransition(row, nextStatus);
  await row.save();

  const item = await Shift.findById(row._id).populate(SHIFT_POPULATE).lean();
  res.json({ success: true, data: { item, warnings } });
});

/**
 * Who can work this slot — every active employee, judged before anybody is
 * ticked.
 *
 * The point is that this and the refusal on save run the SAME `checkAssignment`
 * over the same context, so a badge in the picker and the 409 from the write
 * can never disagree. It is a POST because it carries a window and a role, not
 * because it changes anything.
 */
const shiftAvailability = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;

  if (!isObjectIdLike(req.body.role)) {
    return badRequest(res, 'Choose the role this shift needs');
  }
  const times = validateShiftTimes(req.body.start, req.body.end);
  if (!times.ok) return badRequest(res, times.message);

  const window = { start: new Date(req.body.start), end: new Date(req.body.end) };
  const excludeId = isObjectIdLike(req.body.excludeId) ? req.body.excludeId : null;

  const staff = await User.find(buildEmployeeFilter(tenantId, { status: 'active' }))
    .select('_id')
    .lean();
  const ids = staff.map((s) => String(s._id));

  const byId = await assignmentContexts(tenantId, ids, window, excludeId);
  // A null entry — an id the context load did not resolve to a user — is kept
  // rather than dropped, the same as the two save paths do, so `checkAssignment`
  // judges it and answers `no_employee` rather than the slot silently skipping
  // them. `judgeAssignments` hands that verdict's `employee` field straight
  // back out, though, and it is exactly what went in: null. Left alone, that
  // would make `personRef(null)` return null too, and `mergeAvailability` on
  // the client drops any verdict without an `employee._id` — observationally
  // identical to having been filtered out, the opposite of what was intended.
  // `unresolvedIds` below is what puts the id back once the judging is done.
  const candidates = ids.map((id) => byId.get(id)?.employee ?? null);
  const unresolvedIds = ids.filter((id, i) => candidates[i] === null);

  // force:false always — this answers "is anything in the way?", and forcing is
  // a decision the admin makes afterwards, from the `forceable` flag.
  const { allowed, blocked } = judgeAssignments(
    { role: req.body.role, ...window, ...(excludeId ? { _id: excludeId } : {}) },
    candidates,
    byId,
    { force: false }
  );

  // `judgeAssignments` visits `candidates` in order and only ever buckets each
  // one into `allowed` or `blocked`, so a `no_employee` verdict's position
  // among the OTHER `no_employee` verdicts is preserved — the same order
  // `unresolvedIds` was collected in above. That is what makes pairing them
  // back up by a running index safe, without judgeAssignments itself having to
  // carry the id through (it never rules on anything; `checkAssignment` does).
  let unresolvedIndex = 0;
  const items = allowed
    .map((a) => ({
      employee: personRef(a.employee),
      ok: true,
      code: null,
      message: null,
      forceable: false,
    }))
    .concat(
      blocked.map((b) => ({
        employee:
          personRef(b.employee) ??
          (b.code === 'no_employee' ? { _id: unresolvedIds[unresolvedIndex++] } : null),
        ok: false,
        code: b.code,
        message: b.message,
        forceable: b.forceable,
      }))
    )
    .sort((a, b) =>
      `${a.employee?.firstName ?? ''} ${a.employee?.lastName ?? ''}`.localeCompare(
        `${b.employee?.firstName ?? ''} ${b.employee?.lastName ?? ''}`
      )
    );

  res.json({ success: true, data: { items } });
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
    .select('_id template templatePosition start status')
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
 * POST /api/shifts/fill — put several people on one repeating pattern.
 *
 * Where /generate builds an open roster from many templates, this fills ONE
 * template with named people across a range: N people x M worked days.
 *
 * Blocked person-days are SKIPPED, not refused — see planPatternFill. `skipped`
 * is returned in full and never swallowed: "created 0 shifts" with no reason is
 * indistinguishable from a broken feature.
 */
const fillPattern = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);
  const range = parseRosterRange(req.body, offsetMinutes);
  if (!range.ok) return badRequest(res, range.message);

  if (!isObjectIdLike(req.body.templateId)) {
    return badRequest(res, 'Choose a shift pattern to fill from');
  }

  // Seats: {employee, position}. A bare id is still accepted — f91201bb shipped
  // this endpoint taking a flat list and planPatternFill.normaliseSeats maps a
  // bare entry onto the template's sole position.
  const rawSeats = Array.isArray(req.body.employees) ? req.body.employees : [];
  const seatSpecs = [];
  const seen = new Set();
  for (const raw of rawSeats) {
    const employeeId = isObjectIdLike(raw) ? String(raw) : String(raw?.employee ?? '');
    if (!isObjectIdLike(employeeId) || seen.has(employeeId)) continue;
    seen.add(employeeId);
    const position = isObjectIdLike(raw?.position) ? String(raw.position) : null;
    seatSpecs.push({ employeeId, position });
  }
  const employeeIds = seatSpecs.map((s) => s.employeeId);
  if (!employeeIds.length) {
    return badRequest(res, 'Choose at least one employee to put on this pattern');
  }

  const template = await ShiftTemplate.findOne({
    tenant: tenantId,
    _id: req.body.templateId,
  }).lean();
  if (!template) {
    return badRequest(res, 'That shift pattern does not exist in your organisation');
  }

  // Bound the N (employees) x M (worked days) product before planning anything
  // — days alone are already capped by parseRosterRange/MAX_GENERATION_DAYS,
  // but nothing else bounds the person axis. Counted in WORKED days, not
  // calendar days: a template that only works alternate days (the common
  // one-on/one-off rota) would otherwise be refused at roughly half the real
  // cap. When the template can't be planned at all (inactive, empty
  // cycleDays, invalid time) the count is 0 here so the request falls
  // through to the planner below, which reports the specific reason in
  // `skipped` instead of this generic row-cap message masking it.
  const plan = patternDates(template, eachDateInRange(range.from, range.to));
  const workedDays = plan.ok ? plan.dates.length : 0;
  if (employeeIds.length * workedDays > MAX_FILL_ROWS) {
    return badRequest(
      res,
      `That would create ${employeeIds.length * workedDays} shifts, more than the ${MAX_FILL_ROWS} allowed in one fill — narrow the date range or choose fewer people`
    );
  }

  // ONE context load for the WHOLE range. A per-day load would be up to
  // MAX_GENERATION_DAYS round trips; the planner judges day by day in memory.
  //
  // Widened past `range.end`: a candidate shift built per date can run PAST it
  // whenever the template crosses midnight or carries endDayOffset > 0, and an
  // un-widened window would silently hide an existing shift or approved leave
  // that starts exactly at that boundary from checkAssignment.
  const contextWindow = fillContextWindow(range, template);
  const ctxById = await assignmentContexts(
    tenantId,
    employeeIds,
    contextWindow,
    null
  );

  // Only rows from THIS template matter for idempotency — an unrelated hand-made
  // shift at the same time is a legitimate second slot, and any genuine clash
  // with one is caught by checkAssignment as an overlap instead.
  const existing = await Shift.find({
    tenant: tenantId,
    template: template._id,
    start: { $gte: range.start, $lt: range.end },
  })
    .select('_id template templatePosition employee start status')
    .lean();

  // Only the employees who actually resolved — assignmentContexts drops deleted
  // and cross-tenant ids, and a missing person must not become a silent no-op.
  const employees = employeeIds
    .map((id) => ctxById.get(id)?.employee)
    .filter(Boolean);
  const missing = employeeIds.filter((id) => !ctxById.get(id)?.employee);

  const employeeById = new Map(employees.map((e) => [String(e._id), e]));
  const seats = seatSpecs
    .filter((s) => employeeById.has(s.employeeId))
    .map((s) => ({ employee: employeeById.get(s.employeeId), position: s.position }));

  const { toCreate, skipped } = planPatternFill(template, seats, {
    from: range.from,
    to: range.to,
    offsetMinutes,
    existing,
    ctxById,
    force: req.body.force === true,
  });

  // `date` is the planner's own bookkeeping — the instant is already in start.
  const docs = toCreate.map(({ date, ...s }) => ({
    ...s,
    tenant: tenantId,
    createdBy: req.user?._id,
  }));

  const created = docs.length ? await Shift.insertMany(docs) : [];

  res.status(201).json({
    success: true,
    data: {
      created: created.length,
      items: created.map((d) => d.toObject()),
      skipped: [
        ...missing.map((id) => ({
          employee: id,
          name: 'Unknown employee',
          code: 'no_employee',
          reason: 'That employee is no longer in your organisation',
          forceable: false,
        })),
        ...skipped,
      ],
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
    fill: fillPattern,
    publish: publishShifts,
    availability: shiftAvailability,
  },
};
