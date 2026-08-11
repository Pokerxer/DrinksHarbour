// server/controllers/attendance.controller.js
//
// The clock: kiosk punches, the manager's daily log, and corrections.
//
// Every rule — what the button means, which shift a punch belongs to, whether
// somebody was late, what a correction may say — lives in
// services/attendance.helpers.js and is unit-tested without a database. This
// file is the IO around them: tenant scoping, loading what a rule needs, and
// turning a refusal into an HTTP status.
//
// TWO THINGS THIS FILE IS CAREFUL ABOUT
// -------------------------------------
// 1. The kiosk never confirms a PIN. Whether the code was unknown, belonged to
//    another tenant, or belonged to a suspended account, the answer is one
//    generic 401 — otherwise the pad becomes an oracle for guessing PINs, and
//    it is mounted on a screen in a shop.
// 2. `status` and `minutesWorked` are derived by resolveAttendanceTimes on
//    every write path. Nothing here copies them off the request body.

const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');

const Attendance = require('../models/Attendance');
const Shift = require('../models/Shift');
const TimeOffRequest = require('../models/TimeOffRequest');
const User = require('../models/User');

const { isObjectIdLike } = require('../services/orgStructure.helpers');
const {
  parseRosterRange,
  tenantOffsetMinutes: offsetForTenant,
  tenantToday,
} = require('../services/shift.helpers');
const {
  ATTENDANCE_STATUSES,
  DEFAULT_MATCH_WINDOW_MINUTES,
  resolveClockAction,
  matchShiftForClock,
  describePunctuality,
  summariseAttendance,
  buildAttendancePayload,
  resolveAttendanceTimes,
  lastPunchAt,
  isPunchTooSoon,
  resolveClockCredential,
} = require('../services/attendance.helpers');
const {
  rateAttendance,
  isExcused,
  describeDeparture,
  unrosteredRecords,
} = require('../services/attendanceRating.helpers');

const MS_PER_MINUTE = 60_000;

const RECORD_POPULATE = [
  { path: 'employee', select: 'firstName lastName email avatar' },
  { path: 'shift', select: 'start end status role', populate: { path: 'role', select: 'name color' } },
  { path: 'editedBy', select: 'firstName lastName email' },
];

/** The tenant's UTC offset, off the request. The rule is in shift.helpers.js. */
function tenantOffsetMinutes(req) {
  return offsetForTenant(req.tenant);
}

function notFound(res) {
  return res.status(404).json({ success: false, message: 'Attendance record not found' });
}

function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

/** Display fields only. Never the PIN hash, and never a list of other people. */
function publicEmployee(user) {
  if (!user) return null;
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
  };
}

/**
 * Decorate rows with the punctuality their shift implies.
 *
 * Not stored: it is a function of the punch and the shift, and both can be
 * corrected. Deriving it on read means a corrected clock-in stops being late
 * the moment it is fixed, instead of carrying a stale verdict forever.
 * summariseAttendance counts `late` off this field, so it has to run first.
 */
function withPunctuality(rows) {
  return rows.map((r) => ({ ...r, punctuality: describePunctuality(r.clockIn, r.shift) }));
}

/** Confirm a referenced employee is one of this tenant's people. */
async function employeeInTenant(tenantId, employeeId) {
  return User.findOne({ _id: employeeId, tenant: tenantId, status: { $ne: 'deleted' } })
    .select('firstName lastName email avatar status')
    .lean();
}

// ── Kiosk ────────────────────────────────────────────────────────────────────

/**
 * POST /api/attendance/clock  { pin } | { badge }
 *
 * One endpoint, not two: the employee presses one button and the state of their
 * last record decides whether it is an in or an out. A separate /clock-out
 * would let the two disagree — someone clocking out twice, or in twice — and
 * the pad would have to know which to show before it knew who was standing at
 * it, which it must not.
 *
 * Two credentials, deliberately different:
 *   * `pin`   — a secret. Resolved by bcrypt compare over the tenant's
 *     staff who have one, and answered with ONE generic 401 on any failure.
 *   * `badge` — the QR payload printed on the employee's badge card
 *     (employeeProfile.attendance.rfidBadge, or the employee _id as the
 *     fallback the badge generator encodes). Physical possession is the
 *     credential, so it is NOT secret: a scan is answered with a distinct
 *     message when no employee matches, and no PIN needs to exist for the
 *     badge to work.
 *
 * WHICH of the two is on offer now depends on how the request authenticated.
 * `req.kioskDevice` means a screen paired by token with nobody signed in behind
 * it, and there the pad takes badges only — the rule, and the reasoning, are in
 * resolveClockCredential.
 */
const clock = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const pin = req.body?.pin;
  const badge = req.body?.badge;

  const credential = resolveClockCredential(req.body, { allowPin: !req.kioskDevice });
  if (!credential.ok) return badRequest(res, credential.message);

  let matched = null;

  if (credential.kind === 'badge') {
    // The badge lookup deliberately does NOT filter on posPinHash: a driver
    // or attendant must be able to punch with the card on their lanyard even
    // though nobody has handed them a till PIN.
    const code = String(badge).trim();

    // rfidBadge first, then the _id fallback — a card's payload is whichever
    // one the generator encoded, and a raw 24-hex string could be either.
    matched = await User.findOne({
      tenant: tenantId,
      status: 'active',
      'employeeProfile.attendance.rfidBadge': code,
    }).select('firstName lastName email avatar');

    if (!matched && isObjectIdLike(code)) {
      matched = await User.findOne({
        tenant: tenantId,
        _id: code,
        status: 'active',
      }).select('firstName lastName email avatar');
    }

    // Distinct from the PIN's answer on purpose: a badge is printed on a card
    // in public, so naming the failure leaks nothing worth hiding. What it
    // still refuses to do is say WHY — suspended, other tenant, never issued —
    // all of which are a manager's business, not the shop floor's.
    if (!matched) {
      return res.status(401).json({
        success: false,
        message: 'Badge not recognised',
      });
    }
  } else {
    // The candidate set deliberately does NOT filter on posAccess. Clocking in is
    // not a till privilege: drivers, attendants and office staff have to be able
    // to punch without being handed the ability to take money. The consequence,
    // accepted knowingly, is that User.posPinHash is the only PIN that exists, so
    // anybody expected to clock in by PIN must have one set on their profile.
    const candidates = await User.find({
      tenant: tenantId,
      status: 'active',
      posPinHash: { $exists: true, $ne: null },
    }).select('+posPinHash firstName lastName email avatar');

    for (const u of candidates) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design: bcrypt
      // is intentionally slow and the set is one tenant's staff, not a user table.
      if (await bcrypt.compare(String(pin), u.posPinHash)) {
        matched = u;
        break;
      }
    }

    // One answer for every failure. Never "no such PIN" vs "that account is
    // suspended" — either would turn the pad into a directory of valid codes.
    if (!matched) return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }

  const now = new Date();
  const open = await Attendance.findOne({
    tenant: tenantId,
    employee: matched._id,
    status: 'open',
  }).sort({ clockIn: -1 });

  const action = resolveClockAction(open);

  // The double-punch floor, enforced here rather than only in the pad because
  // the pad is not the only thing that can post to this endpoint. A camera
  // kiosk decodes the badge in front of it about ten times a second, so a card
  // resting against the lens would otherwise clock somebody in and straight
  // back out — writing a closed record with zero minutes on it.
  //
  // Whichever record is relevant carries the previous punch: the open one's
  // clock-in when this press is an out, and the last closed one's clock-out
  // when it is an in.
  const previous =
    open ||
    (await Attendance.findOne({
      tenant: tenantId,
      employee: matched._id,
      status: 'closed',
    })
      .sort({ clockOut: -1 })
      .select('clockIn clockOut')
      .lean());

  if (isPunchTooSoon(lastPunchAt(previous), now)) {
    return res.status(409).json({
      success: false,
      code: 'too_soon',
      message: 'That was just registered. Try again in a moment.',
    });
  }

  if (action === 'out') {
    const times = resolveAttendanceTimes(open.clockIn, now);
    if (!times.ok) {
      // Almost always a double-press within the same second. Say so rather than
      // writing a zero-length record that will look like a payroll error later.
      return res.status(409).json({
        success: false,
        code: 'too_soon',
        message: 'You have only just clocked in. Try again in a moment.',
      });
    }
    open.clockOut = now;
    open.status = times.status;
    open.minutesWorked = times.minutesWorked;
    await open.save();

    const item = await Attendance.findById(open._id).populate(RECORD_POPULATE).lean();
    return res.json({
      success: true,
      data: {
        action: 'out',
        employee: publicEmployee(matched),
        item,
        punctuality: describePunctuality(item.clockIn, item.shift),
      },
    });
  }

  // Clocking in: attach whichever of this employee's shifts the punch belongs
  // to. The DB only narrows to shifts near the punch — matchShiftForClock makes
  // the decision, so the window rule and the cancelled-shift rule stay in one
  // place and stay tested.
  const slack = DEFAULT_MATCH_WINDOW_MINUTES * MS_PER_MINUTE;
  const nearby = await Shift.find({
    tenant: tenantId,
    employee: matched._id,
    status: { $ne: 'cancelled' },
    start: { $lte: new Date(now.getTime() + slack) },
    end: { $gte: new Date(now.getTime() - slack) },
  })
    .select('_id start end status role')
    .lean();

  const shift = matchShiftForClock(now, nearby);

  const row = await Attendance.create({
    tenant: tenantId,
    employee: matched._id,
    shift: shift ? shift._id : null,
    clockIn: now,
    clockOut: null,
    source: 'kiosk',
    status: 'open',
    minutesWorked: 0,
  });

  const item = await Attendance.findById(row._id).populate(RECORD_POPULATE).lean();
  res.status(201).json({
    success: true,
    data: {
      action: 'in',
      employee: publicEmployee(matched),
      item,
      punctuality: describePunctuality(item.clockIn, item.shift),
    },
  });
});

// ── Manager log ──────────────────────────────────────────────────────────────

/**
 * GET /api/attendance?from=&to=&employee=&status=
 *
 * The window is parsed by shift.helpers#parseRosterRange — the same parser the
 * roster uses, so "this week" means the same instants on both screens. With no
 * dates at all it is today on the tenant's calendar, which is what a manager
 * opening the page wants and what the kiosk's own day is measured against.
 */
const list = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);

  const today = tenantToday(offsetMinutes);
  const range = parseRosterRange(
    { from: req.query.from || today, to: req.query.to || req.query.from || today },
    offsetMinutes
  );
  if (!range.ok) return badRequest(res, range.message);

  const filter = { tenant: tenantId, clockIn: { $gte: range.start, $lt: range.end } };
  if (isObjectIdLike(req.query.employee)) filter.employee = req.query.employee;
  if (ATTENDANCE_STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const rows = await Attendance.find(filter).populate(RECORD_POPULATE).sort({ clockIn: -1 }).lean();
  const items = withPunctuality(rows);

  res.json({
    success: true,
    data: { items, summary: summariseAttendance(items), range: { from: range.from, to: range.to } },
  });
});

/**
 * GET /api/attendance/employee/:employeeId?from=&to=
 *
 * One person's history over a window, with the rating it adds up to.
 *
 * Three collections, because a rating cannot be built from punches alone: the
 * ROSTER supplies the denominator (a no-show leaves no record to count), and
 * approved TIME OFF removes the shifts nobody should be marked down for. The
 * arithmetic itself is in attendanceRating.helpers.js — this function only
 * fetches.
 *
 * The timeline is shift-led rather than punch-led for the same reason: it has
 * to be able to show a row for a shift that produced nothing at all.
 */
const employeeHistory = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const offsetMinutes = tenantOffsetMinutes(req);
  const { employeeId } = req.params;

  if (!isObjectIdLike(employeeId)) return badRequest(res, 'Invalid employee id');

  const employee = await employeeInTenant(tenantId, employeeId);
  if (!employee) {
    return res.status(404).json({ success: false, message: 'Employee not found' });
  }

  const today = tenantToday(offsetMinutes);
  const range = parseRosterRange(
    { from: req.query.from || today, to: req.query.to || req.query.from || today },
    offsetMinutes
  );
  if (!range.ok) return badRequest(res, range.message);

  const [rows, shifts, timeOff] = await Promise.all([
    Attendance.find({
      tenant: tenantId,
      employee: employeeId,
      clockIn: { $gte: range.start, $lt: range.end },
    })
      .populate(RECORD_POPULATE)
      .sort({ clockIn: -1 })
      .lean(),

    // Cancelled shifts are dropped here; draft and not-yet-ended ones are left
    // for pairShiftsWithAttendance, which owns that rule and is tested on it.
    Shift.find({
      tenant: tenantId,
      employee: employeeId,
      status: { $ne: 'cancelled' },
      start: { $gte: range.start, $lt: range.end },
    })
      .select('_id start end status role breakMinutes')
      .populate({ path: 'role', select: 'name color' })
      .sort({ start: -1 })
      .lean(),

    // Approved only — pending leave is still a question. overlapsTimeOff
    // re-checks this, but there is no reason to ship the rest over the wire.
    TimeOffRequest.find({
      tenant: tenantId,
      employee: employeeId,
      status: 'approved',
      startDate: { $lt: range.end },
      endDate: { $gt: range.start },
    })
      .select('_id startDate endDate status type')
      .lean(),
  ]);

  const items = withPunctuality(rows);
  const rating = rateAttendance(
    { shifts, records: items, timeOff },
    { now: new Date() }
  );

  // Shift-led, so an absence gets a row. Unrostered punches are appended after
  // it, because they belong to no shift but still happened.
  const byShift = new Map();
  for (const r of items) {
    const key = r.shift?._id ? String(r.shift._id) : '';
    if (key) byShift.set(key, r);
  }

  const timeline = shifts.map((s) => {
    const record = byShift.get(String(s._id)) || null;
    return {
      shift: s,
      record,
      excused: isExcused(s, timeOff),
      punctuality: record ? record.punctuality : null,
      departure: describeDeparture(record, s),
    };
  });

  // Not `!r.shift`: a record whose shift was cancelled after it was worked, or
  // whose shift sits outside this window, cites a shift that no timeline row
  // will carry. Filtering on "has no shift id" left those rendering nowhere on
  // the page while their minutes still counted towards the summary. The rule is
  // in attendanceRating.helpers.js so the list and `counts.unrostered` cannot
  // disagree about which punches went unaccounted for.
  const unrostered = unrosteredRecords(items, shifts);

  res.json({
    success: true,
    data: {
      employee: publicEmployee(employee),
      range: { from: range.from, to: range.to },
      rating,
      timeline,
      unrostered,
      summary: summariseAttendance(items),
    },
  });
});

/**
 * POST /api/attendance — a manual entry.
 *
 * `source: 'admin'` is set here and is not settable from the body: the field is
 * what the delete guard reads, so a client that could write it could relabel a
 * kiosk punch as its own and then erase it.
 */
const create = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  const built = buildAttendancePayload(req.body, { isUpdate: false });
  if (!built.ok) return badRequest(res, built.message);

  const employee = await employeeInTenant(tenantId, built.value.employee);
  if (!employee) return badRequest(res, 'That employee is not in your organisation');

  if (built.value.shift) {
    const shift = await Shift.findOne({ _id: built.value.shift, tenant: tenantId })
      .select('_id')
      .lean();
    if (!shift) return badRequest(res, 'That shift is not in your organisation');
  }

  const times = resolveAttendanceTimes(built.value.clockIn, built.value.clockOut ?? null);
  if (!times.ok) return badRequest(res, times.message);

  // Refused rather than allowed, because a second open record would make the
  // kiosk's next press close one of them arbitrarily and leave the other open
  // forever. Close the existing one first.
  if (times.status === 'open') {
    const already = await Attendance.findOne({
      tenant: tenantId,
      employee: built.value.employee,
      status: 'open',
    })
      .select('_id clockIn')
      .lean();
    if (already) {
      return res.status(409).json({
        success: false,
        code: 'already_open',
        message: 'This employee is already clocked in. Close that record before opening another.',
      });
    }
  }

  const row = await Attendance.create({
    ...built.value,
    tenant: tenantId,
    source: 'admin',
    status: times.status,
    minutesWorked: times.minutesWorked,
    createdBy: req.user?._id,
  });

  const item = await Attendance.findById(row._id).populate(RECORD_POPULATE).lean();
  res.status(201).json({ success: true, data: { item } });
});

/**
 * PATCH /api/attendance/:id — a correction.
 *
 * Always stamps `editedBy`. A corrected punch that cannot say who changed it is
 * worse than an uncorrected one: it is the employee's own record of what they
 * did, and somebody overwrote it.
 */
const update = asyncHandler(async (req, res) => {
  const tenantId = req.tenant?._id;
  if (!isObjectIdLike(req.params.id)) return notFound(res);

  const row = await Attendance.findOne({ _id: req.params.id, tenant: tenantId });
  if (!row) return notFound(res);

  const built = buildAttendancePayload(req.body, { isUpdate: true });
  if (!built.ok) return badRequest(res, built.message);

  if (built.value.employee) {
    const employee = await employeeInTenant(tenantId, built.value.employee);
    if (!employee) return badRequest(res, 'That employee is not in your organisation');
  }
  if (built.value.shift) {
    const shift = await Shift.findOne({ _id: built.value.shift, tenant: tenantId })
      .select('_id')
      .lean();
    if (!shift) return badRequest(res, 'That shift is not in your organisation');
  }

  // A correction may send one end only, so the other comes off the stored
  // document. `clockOut: null` is a real instruction — it re-opens the record
  // for somebody who is still here — which is why `undefined` is the test.
  const clockIn = built.value.clockIn ?? row.clockIn;
  const clockOut = built.value.clockOut !== undefined ? built.value.clockOut : row.clockOut;

  const times = resolveAttendanceTimes(clockIn, clockOut);
  if (!times.ok) return badRequest(res, times.message);

  Object.assign(row, built.value);
  row.clockIn = clockIn;
  row.clockOut = clockOut;
  row.status = times.status;
  row.minutesWorked = times.minutesWorked;
  row.editedBy = req.user?._id ?? null;
  await row.save();

  const item = await Attendance.findById(row._id).populate(RECORD_POPULATE).lean();
  res.json({ success: true, data: { item } });
});

/**
 * DELETE /api/attendance/:id — only ever an admin row.
 *
 * A kiosk punch is what the employee actually did. It may be corrected, and the
 * correction is signed, but it may not be erased — deleting it would remove the
 * only record that somebody was at work, with nothing left to say it existed.
 */
const remove = asyncHandler(async (req, res) => {
  if (!isObjectIdLike(req.params.id)) return notFound(res);

  const row = await Attendance.findOne({ _id: req.params.id, tenant: req.tenant?._id });
  if (!row) return notFound(res);

  if (row.source !== 'admin') {
    return res.status(409).json({
      success: false,
      code: 'kiosk_punch',
      message:
        'This is a clock-in the employee made. It can be corrected, but not deleted.',
    });
  }

  await row.deleteOne();
  res.json({ success: true, message: 'Attendance record deleted' });
});

module.exports = { clock, list, employeeHistory, create, update, remove };
