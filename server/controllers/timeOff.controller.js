// server/controllers/timeOff.controller.js
//
// Time-off requests and shift swaps — the two things staff ask for and a
// manager answers.
//
// Every rule (who approves, which status moves are legal, what a window covers)
// lives in services/timeOff.helpers.js and is unit-tested without a database.
// This file is the IO around them.
//
// WHAT MAKES THIS MODULE DIFFERENT FROM EVERY EARLIER PHASE
// ---------------------------------------------------------
// The roster, templates and attendance are admin screens end to end. These are
// not: an ordinary `tenant_staff` employee has to be able to raise their own
// request and see their own queue, and only the decision is admin-only. So the
// guard is split per-route in routes/timeOff.routes.js, and every read here
// SCOPES rather than refuses — `visibleTo()` narrows a staff member's list to
// their own rows instead of 403'ing them off the endpoint. A 403 on the list
// would be a worse answer, because there is a legitimate list to show them.
//
// THE ONE ASYMMETRY WORTH KNOWING
// --------------------------------
// `checkAssignment` REFUSES to roster somebody onto approved time off, and
// `force` cannot override it. Approving time off over shifts they are already
// rostered on does NOT refuse — it approves and reports the shifts as warnings.
// The direction is the reason: in the first case the leave is settled and the
// new shift is the mistake; in the second the leave is the answer to a human
// question and the roster is the thing that has to change. Silence is what is
// not allowed, so the clashing shifts come back in the response either way.

const asyncHandler = require('../utils/asyncHandler');

const TimeOffRequest = require('../models/TimeOffRequest');
const ShiftSwapRequest = require('../models/ShiftSwapRequest');
const Shift = require('../models/Shift');
const User = require('../models/User');

const { isObjectIdLike } = require('../services/orgStructure.helpers');
const {
  parseRosterRange,
  checkAssignment,
  tenantOffsetMinutes: offsetForTenant,
} = require('../services/shift.helpers');
const {
  TIME_OFF_STATUSES,
  SWAP_STATUSES,
  canTransitionTimeOff,
  canTransitionSwap,
  resolveTimeOffAction,
  resolveSwapAction,
  resolveApprover,
  buildTimeOffPayload,
  buildSwapPayload,
  checkSwapShiftStillValid,
} = require('../services/timeOff.helpers');
const { assignmentContext } = require('./shift.controller');

const REQUEST_POPULATE = [
  { path: 'employee', select: 'firstName lastName email avatar' },
  { path: 'approver', select: 'firstName lastName email' },
  { path: 'decidedBy', select: 'firstName lastName email' },
];

const SWAP_POPULATE = [
  { path: 'requestedBy', select: 'firstName lastName email avatar' },
  { path: 'targetEmployee', select: 'firstName lastName email avatar' },
  { path: 'approver', select: 'firstName lastName email' },
  { path: 'decidedBy', select: 'firstName lastName email' },
  {
    path: 'shift',
    select: 'start end status role department employee',
    populate: [
      { path: 'role', select: 'name color' },
      { path: 'department', select: 'name color' },
    ],
  },
];

const ADMIN_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];

/** May this caller decide other people's requests? */
function isAdmin(req) {
  return ADMIN_ROLES.includes(req.user?.role);
}

function selfId(req) {
  return String(req.user?._id || '');
}

function notFound(res, label) {
  return res.status(404).json({ success: false, message: `${label} not found` });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

function forbidden(res, message) {
  return res.status(403).json({ success: false, message });
}

/** A refusal ({code, message, conflicts}) as the 409 the client expects. */
function conflict(res, refusal) {
  return res.status(409).json({
    success: false,
    code: refusal.code,
    message: refusal.message,
    conflicts: refusal.conflicts || [],
  });
}

function badTransition(res, from, to) {
  return conflict(res, {
    code: 'bad_transition',
    message: `A ${from} request cannot become ${to}`,
  });
}

/**
 * Everyone in this tenant who could decide a request.
 *
 * Sorted by role so `tenant_admin` comes before `tenant_owner` alphabetically:
 * the fallback should land on a manager rather than escalating straight to the
 * owner, and a deterministic order means the same request routes the same way
 * every time it is retried.
 */
async function adminCandidates(tenantId) {
  return User.find({
    tenant: tenantId,
    status: 'active',
    role: { $in: ['tenant_owner', 'tenant_admin'] },
  })
    .select('_id role')
    .sort({ role: 1, _id: 1 })
    .lean();
}

/** One of this tenant's people, or null. */
async function employeeInTenant(tenantId, employeeId) {
  return User.findOne({ _id: employeeId, tenant: tenantId, status: { $ne: 'deleted' } })
    .select('firstName lastName email status employeeProfile.approvers employeeProfile.work')
    .lean();
}

/** Route the request, and record who it landed on at the time it was raised. */
async function routeApprover(tenantId, employee) {
  const admins = await adminCandidates(tenantId);
  return resolveApprover(employee, { admins });
}

// ── Time off ─────────────────────────────────────────────────────────────────

/**
 * GET /api/time-off?from=&to=&status=&employee=&scope=
 *
 * The date window is optional — an approval queue is a question about status,
 * not about dates — but when it is given it is parsed by
 * shift.helpers#parseRosterRange, the same parser the roster and the attendance
 * log use, so "this week" means the same instants on every screen.
 *
 * A `tenant_staff` caller is silently narrowed to their own rows. That is not a
 * softened 403: they have a real list to see, it is just theirs.
 */
const listTimeOff = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const filter = { tenant: tenantId };

  if (req.query.from) {
    const range = parseRosterRange(
      { from: req.query.from, to: req.query.to || req.query.from },
      offsetForTenant(req.tenant)
    );
    if (!range.ok) return badRequest(res, range.message);
    // Overlap, not containment: a fortnight's leave that straddles the edge of
    // the month being viewed is still leave in that month.
    filter.startDate = { $lt: range.end };
    filter.endDate = { $gt: range.start };
  }

  if (TIME_OFF_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  if (!isAdmin(req)) filter.employee = selfId(req);
  else if (req.query.scope === 'mine') filter.employee = selfId(req);
  else if (isObjectIdLike(req.query.employee)) filter.employee = req.query.employee;

  const items = await TimeOffRequest.find(filter)
    .populate(REQUEST_POPULATE)
    .sort({ startDate: -1 })
    .lean();

  res.json({ success: true, data: { items, canDecide: isAdmin(req) } });
});

/**
 * POST /api/time-off
 *
 * Staff may file only their own; an admin may file on somebody's behalf. The
 * body's `employee` is therefore a request, not an instruction — it is honoured
 * only for a caller who is allowed to use it.
 */
const createTimeOff = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const built = buildTimeOffPayload(req.body, { offsetMinutes: offsetForTenant(req.tenant) });
  if (!built.ok) return badRequest(res, built.message);

  const asked = built.value.employee;
  if (asked && !isAdmin(req) && asked !== selfId(req)) {
    return forbidden(res, 'You can only request time off for yourself');
  }
  const employeeId = asked && isAdmin(req) ? asked : selfId(req);

  const employee = await employeeInTenant(tenantId, employeeId);
  if (!employee) return badRequest(res, 'That employee is not in your organisation');

  // Two live requests over the same days is not a second holiday, it is a
  // duplicate — and it would make the approval queue ambiguous about which one
  // the roster is blocked by.
  const clashing = await TimeOffRequest.find({
    tenant: tenantId,
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lt: built.value.endDate },
    endDate: { $gt: built.value.startDate },
  })
    .select('_id type status startDate endDate halfDay days')
    .lean();

  if (clashing.length) {
    return conflict(res, {
      code: 'overlapping_request',
      message: 'There is already a request covering some of those days',
      conflicts: clashing,
    });
  }

  const row = await TimeOffRequest.create({
    ...built.value,
    employee: employeeId,
    tenant: tenantId,
    status: 'pending',
    approver: await routeApprover(tenantId, employee),
    createdBy: req.user?._id,
  });

  const item = await TimeOffRequest.findById(row._id).populate(REQUEST_POPULATE).lean();
  res.status(201).json({ success: true, data: { item } });
});

/**
 * PATCH /api/time-off/:id/decision  { action: 'approve' | 'reject', note }
 *
 * Admin-only, and the one write that feeds Phase 2's assignment guard: after
 * this, `checkAssignment` will refuse to roster this employee over these days.
 *
 * Approving over shifts they are ALREADY on does not refuse — see the note at
 * the top of this file. The shifts come back as a warning so the manager knows
 * exactly what needs re-rostering rather than finding out on the day.
 */
const decideTimeOff = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Time-off request');

  const next = resolveTimeOffAction(req.body?.action);
  if (next !== 'approved' && next !== 'rejected') {
    return badRequest(res, "action must be 'approve' or 'reject'");
  }

  const row = await TimeOffRequest.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Time-off request');
  if (!canTransitionTimeOff(row.status, next)) return badTransition(res, row.status, next);

  const warnings = [];
  if (next === 'approved') {
    const rostered = await Shift.find({
      tenant: tenantId,
      employee: row.employee,
      status: { $ne: 'cancelled' },
      start: { $lt: row.endDate },
      end: { $gt: row.startDate },
    })
      .select('_id start end status role')
      .populate({ path: 'role', select: 'name color' })
      .lean();

    if (rostered.length) {
      warnings.push({
        code: 'rostered',
        message: `${rostered.length} shift${rostered.length === 1 ? '' : 's'} in that period need re-rostering`,
        conflicts: rostered,
      });
    }
  }

  row.status = next;
  row.decidedBy = req.user?._id ?? null;
  row.decidedAt = new Date();
  if (req.body?.note !== undefined) row.decisionNote = String(req.body.note).trim();
  await row.save();

  const item = await TimeOffRequest.findById(row._id).populate(REQUEST_POPULATE).lean();
  res.json({ success: true, data: { item, warnings } });
});

/**
 * PATCH /api/time-off/:id/cancel
 *
 * The requester or an admin. Cancelling APPROVED leave is legal on purpose —
 * plans change, and it is the only thing that releases the roster block. What
 * is not legal is un-rejecting or re-approving, which the transition table
 * refuses.
 */
const cancelTimeOff = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Time-off request');

  const row = await TimeOffRequest.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Time-off request');

  if (!isAdmin(req) && String(row.employee) !== selfId(req)) {
    return forbidden(res, 'You can only cancel your own requests');
  }
  if (!canTransitionTimeOff(row.status, 'cancelled')) {
    return badTransition(res, row.status, 'cancelled');
  }

  row.status = 'cancelled';
  row.decidedBy = req.user?._id ?? null;
  row.decidedAt = new Date();
  if (req.body?.note !== undefined) row.decisionNote = String(req.body.note).trim();
  await row.save();

  const item = await TimeOffRequest.findById(row._id).populate(REQUEST_POPULATE).lean();
  res.json({ success: true, data: { item } });
});

// ── Shift swaps ──────────────────────────────────────────────────────────────

/**
 * What a non-admin may see on the swaps board.
 *
 * Their own requests, anything offered to them by name, and the OPEN pending
 * ones — an open swap is an offer to the floor, and hiding it would make the
 * feature pointless. Everything else in the tenant stays out of view.
 */
function visibleTo(userId) {
  return {
    $or: [
      { requestedBy: userId },
      { targetEmployee: userId },
      { targetEmployee: null, status: 'pending' },
    ],
  };
}

/** GET /api/shift-swaps?status=&scope= */
const listSwaps = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const filter = { tenant: tenantId };

  if (SWAP_STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (!isAdmin(req)) Object.assign(filter, visibleTo(selfId(req)));
  else if (req.query.scope === 'mine') Object.assign(filter, visibleTo(selfId(req)));

  const items = await ShiftSwapRequest.find(filter)
    .populate(SWAP_POPULATE)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ success: true, data: { items, canDecide: isAdmin(req) } });
});

/**
 * GET /api/shift-swaps/my-shifts
 *
 * The caller's own published, upcoming shifts — the ones they could offer.
 *
 * This exists because `/api/shifts` is admin-only and deliberately so: Phase 2
 * decided a draft roster is not visible to the people on it. But a member of
 * staff cannot offer a shift they are unable to see, so rather than widening
 * that gate this returns exactly one person's own rows, published only, future
 * only. It reveals nothing about anybody else's week.
 *
 * An admin gets the same self-scoped answer. Offering somebody ELSE's shift is
 * done from the roster, where the full picture is already on screen.
 */
const myShifts = asyncHandler(async (req, res) => {
  const items = await Shift.find({
    tenant: req.tenant?._id,
    employee: selfId(req),
    status: 'published',
    start: { $gt: new Date() },
  })
    .select('_id start end status role department')
    .populate([
      { path: 'role', select: 'name color' },
      { path: 'department', select: 'name color' },
    ])
    .sort({ start: 1 })
    .lean();

  res.json({ success: true, data: { items } });
});

/**
 * POST /api/shift-swaps
 *
 * You may only offer a shift you are actually on. An admin may raise one for
 * whoever is on it, but never for an OPEN shift — there is nobody to take it
 * off, and "swapping" an unassigned slot is just assigning it, which the roster
 * already does properly.
 */
const createSwap = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const built = buildSwapPayload(req.body, { isUpdate: false });
  if (!built.ok) return badRequest(res, built.message);

  const shift = await Shift.findOne({ _id: built.value.shift, tenant: tenantId })
    .select('_id employee role start end status')
    .lean();
  if (!shift) return badRequest(res, 'That shift is not in your organisation');
  if (shift.status === 'cancelled') return badRequest(res, 'That shift has been cancelled');
  if (!shift.employee) {
    return badRequest(res, 'That shift is already open — assign it from the roster instead');
  }
  // A swap is a request about work still to be done. Past shifts are answered
  // by attendance, not by moving a name onto something already finished.
  if (new Date(shift.start).getTime() <= Date.now()) {
    return badRequest(res, 'That shift has already started');
  }

  const owner = String(shift.employee);
  if (!isAdmin(req) && owner !== selfId(req)) {
    return forbidden(res, 'You can only offer a shift you are on');
  }

  if (built.value.targetEmployee) {
    if (built.value.targetEmployee === owner) {
      return badRequest(res, 'That is already their shift');
    }
    const target = await employeeInTenant(tenantId, built.value.targetEmployee);
    if (!target || target.status !== 'active') {
      return badRequest(res, 'That employee cannot take a shift');
    }
  }

  const already = await ShiftSwapRequest.findOne({
    tenant: tenantId,
    shift: shift._id,
    status: { $in: ['pending', 'accepted'] },
  })
    .select('_id status')
    .lean();
  if (already) {
    return conflict(res, {
      code: 'already_requested',
      message: 'That shift is already up for swap',
      conflicts: [already],
    });
  }

  const requester = await employeeInTenant(tenantId, owner);
  const row = await ShiftSwapRequest.create({
    ...built.value,
    tenant: tenantId,
    requestedBy: owner,
    status: 'pending',
    approver: await routeApprover(tenantId, requester),
  });

  const item = await ShiftSwapRequest.findById(row._id).populate(SWAP_POPULATE).lean();
  res.status(201).json({ success: true, data: { item } });
});

/**
 * PATCH /api/shift-swaps/:id/respond  { action: 'accept' | 'reject' }
 *
 * The target answering — NOT the approval. Accepting an OPEN swap is what
 * claims it: the accepter's id is written into `targetEmployee`, which is why
 * the transition table has no `pending → approved` edge. Nothing moves the
 * shift here.
 *
 * The eligibility check runs at accept time as well as at approval. It is not
 * the authoritative one — approval re-runs it against the world as it is then —
 * but letting somebody accept a shift they demonstrably cannot work, and only
 * telling them days later when a manager tries to approve it, is a worse way to
 * find out.
 */
const respondToSwap = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Swap request');

  const next = resolveSwapAction(req.body?.action);
  if (next !== 'accepted' && next !== 'rejected') {
    return badRequest(res, "action must be 'accept' or 'reject'");
  }

  const row = await ShiftSwapRequest.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Swap request');

  // Named at somebody → only they may answer. Open → anybody in the tenant may
  // claim it except the person trying to get rid of it.
  const me = selfId(req);
  const named = row.targetEmployee ? String(row.targetEmployee) : null;
  const mayAnswer = named ? named === me : String(row.requestedBy) !== me;
  if (!mayAnswer) return forbidden(res, 'That request is not yours to answer');
  if (!canTransitionSwap(row.status, next)) return badTransition(res, row.status, next);

  if (next === 'accepted') {
    const shift = await Shift.findOne({ _id: row.shift, tenant: tenantId })
      .select('_id employee role start end status')
      .lean();
    if (!shift) return notFound(res, 'Shift');

    // Checked here as well as at approval. Not the authoritative pass — the
    // decision re-runs it against the world as it is then — but letting
    // somebody accept a shift that has been cancelled, re-rostered or already
    // worked, and only telling them when a manager tries to approve it, is a
    // worse way to find out.
    const stillValid = checkSwapShiftStillValid(row, shift, { now: new Date() });
    if (!stillValid.ok) return conflict(res, stillValid);

    const ctx = await assignmentContext(tenantId, me, shift, shift._id);
    const verdict = checkAssignment(shift, ctx.employee, {
      shifts: ctx.shifts,
      timeOff: ctx.timeOff,
    });
    if (!verdict.ok) return conflict(res, verdict);

    // Claiming an open swap. For a named one this is a no-op rewrite of the
    // same id, which keeps the two paths from needing different code.
    row.targetEmployee = me;
  }

  row.status = next;
  row.respondedAt = new Date();
  await row.save();

  const item = await ShiftSwapRequest.findById(row._id).populate(SWAP_POPULATE).lean();
  res.json({ success: true, data: { item } });
});

/**
 * PATCH /api/shift-swaps/:id/decision  { action: 'approve' | 'reject', note }
 *
 * Admin-only, and the ONLY thing that writes `Shift.employee`.
 *
 * It goes through `assignmentContext` + `checkAssignment` — the same pair the
 * roster's own assign path uses — with NO `force`. A swap is not a way around
 * the overlap rule or approved time off: between the accept and the approval
 * somebody may have been rostered elsewhere or had leave approved, and the
 * check is deliberately re-run against the world as it is now rather than as it
 * was when the target said yes.
 */
const decideSwap = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Swap request');

  const next = resolveSwapAction(req.body?.action);
  if (next !== 'approved' && next !== 'rejected') {
    return badRequest(res, "action must be 'approve' or 'reject'");
  }

  const row = await ShiftSwapRequest.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Swap request');
  if (!canTransitionSwap(row.status, next)) return badTransition(res, row.status, next);

  if (next === 'rejected') {
    row.status = next;
    row.decidedBy = req.user?._id ?? null;
    row.decidedAt = new Date();
    if (req.body?.note !== undefined) row.decisionNote = String(req.body.note).trim();
    await row.save();
    const rejected = await ShiftSwapRequest.findById(row._id).populate(SWAP_POPULATE).lean();
    return res.json({ success: true, data: { item: rejected, warnings: [] } });
  }

  const shift = await Shift.findOne({ _id: row.shift, tenant: tenantId });
  if (!shift) return notFound(res, 'Shift');

  // The roster does not hold still between the accept and the decision, and
  // this is the only write that moves `Shift.employee`. The rule itself is in
  // timeOff.helpers.js — cancelled, already started, re-rostered onto somebody
  // else, or emptied back to open are each a reason the offer no longer refers
  // to what was offered.
  const stillValid = checkSwapShiftStillValid(row, shift, { now: new Date() });
  if (!stillValid.ok) return conflict(res, stillValid);

  // The table forbids approving a `pending` swap, so a null target here would
  // be a corrupted row rather than a normal state. Refuse loudly.
  if (!row.targetEmployee) {
    return conflict(res, { code: 'no_target', message: 'Nobody has accepted that swap yet' });
  }

  const targetId = String(row.targetEmployee);
  const ctx = await assignmentContext(tenantId, targetId, shift, shift._id);
  const verdict = checkAssignment(shift, ctx.employee, {
    shifts: ctx.shifts,
    timeOff: ctx.timeOff,
  });
  if (!verdict.ok) return conflict(res, verdict);

  shift.employee = targetId;
  await shift.save();

  row.status = 'approved';
  row.decidedBy = req.user?._id ?? null;
  row.decidedAt = new Date();
  if (req.body?.note !== undefined) row.decisionNote = String(req.body.note).trim();
  await row.save();

  const item = await ShiftSwapRequest.findById(row._id).populate(SWAP_POPULATE).lean();
  res.json({ success: true, data: { item, warnings: verdict.warnings || [] } });
});

/** PATCH /api/shift-swaps/:id/cancel — the requester withdraws, or an admin does. */
const cancelSwap = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res, 'Swap request');

  const row = await ShiftSwapRequest.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res, 'Swap request');

  if (!isAdmin(req) && String(row.requestedBy) !== selfId(req)) {
    return forbidden(res, 'You can only withdraw your own request');
  }
  if (!canTransitionSwap(row.status, 'cancelled')) {
    return badTransition(res, row.status, 'cancelled');
  }

  row.status = 'cancelled';
  row.decidedBy = req.user?._id ?? null;
  row.decidedAt = new Date();
  await row.save();

  const item = await ShiftSwapRequest.findById(row._id).populate(SWAP_POPULATE).lean();
  res.json({ success: true, data: { item } });
});

module.exports = {
  timeOff: {
    list: listTimeOff,
    create: createTimeOff,
    decide: decideTimeOff,
    cancel: cancelTimeOff,
  },
  swaps: {
    list: listSwaps,
    myShifts,
    create: createSwap,
    respond: respondToSwap,
    decide: decideSwap,
    cancel: cancelSwap,
  },
};
