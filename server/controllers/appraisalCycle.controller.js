// server/controllers/appraisalCycle.controller.js — HR-facing cycle management
const mongoose = require('mongoose');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalNudge = require('../models/AppraisalNudge');
const User = require('../models/User');
const {
  planCycleLaunch, buildDefaultTemplate, TENANT_ROLES,
  outstandingActionsFor, countApprovedPeers,
} = require('../services/appraisal.helpers');

/**
 * Resolve the tenant's default template, seeding it on first use.
 *
 * Atomic upsert, not findOne-then-create. The old form was check-then-act:
 * two concurrent first-ever createCycle calls for one tenant both saw no
 * template and both created one. The `{tenant}` partial unique index (filtered
 * to isDefault+isLatest) makes that impossible to write; the upsert makes the
 * winner returnable and the 11000 catch makes the loser recover by reading
 * rather than 500ing.
 *
 * Exported for testing: the concurrency behaviour is the whole point and is
 * not reachable through createCycle alone.
 */
async function ensureDefaultTemplate(tenant, userId) {
  const filter = { tenant, isDefault: true, isLatest: true };
  try {
    // An upsert seeds the inserted document from its query's equality
    // predicates, so naming tenant/isDefault/isLatest in $setOnInsert too
    // raises a path conflict instead of inserting. Destructured out here.
    const { tenant: _t, isDefault: _d, isLatest: _l, ...seed } =
      buildDefaultTemplate(tenant, userId);
    return await AppraisalTemplate.findOneAndUpdate(
      filter,
      { $setOnInsert: seed },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err?.code === 11000) return AppraisalTemplate.findOne(filter);
    throw err;
  }
}

exports.ensureDefaultTemplate = ensureDefaultTemplate;

/**
 * Every cycle in the tenant, each carrying its own appraisal counts by state.
 *
 * The counts are ONE aggregate for the whole list, not a lookup per row: the
 * cycles page renders every cycle the tenant has ever run, so a per-row query
 * is an N+1 that gets slower every review season. Grouping on {cycle, state}
 * gives the page the same `byState` vocabulary cycleProgress already returns
 * for a single cycle, so the client computes "released %" with one shared
 * function instead of two drifting ones.
 *
 * No .catch(() => []) on the aggregate, for the reason cycleProgress spells
 * out: a failure that degrades to zeroes reports every cycle as empty, which
 * reads as a legitimate answer HR would act on. It throws to next() instead.
 */
exports.listCycles = async (req, res, next) => {
  try {
    // aggregate does no schema casting, so the tenant has to be a real
    // ObjectId here — a string $match silently matches nothing and every
    // cycle would come back with no counts at all.
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);
    const [cycles, counts] = await Promise.all([
      AppraisalCycle.find({ tenant: req.tenant._id }).sort({ createdAt: -1 }).lean(),
      Appraisal.aggregate([
        { $match: { tenant: tenantId } },
        { $group: { _id: { cycle: '$cycle', state: '$state' }, count: { $sum: 1 } } },
      ]),
    ]);

    const byCycle = new Map();
    for (const row of counts) {
      const key = String(row._id.cycle);
      if (!byCycle.has(key)) byCycle.set(key, {});
      byCycle.get(key)[row._id.state] = row.count;
    }

    res.json({
      success: true,
      // `?? {}` and not `?? undefined`: a cycle with no appraisals must still
      // carry the shape, so the client can tell "not launched yet" from a
      // payload that never had counts on it.
      data: cycles.map((c) => ({ ...c, byState: byCycle.get(String(c._id)) ?? {} })),
    });
  } catch (err) { next(err); }
};

exports.createCycle = async (req, res, next) => {
  try {
    const { name, nominationDeadline, feedbackDeadline, peerReviewEnabled } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Cycle name is required' });
    }
    // A caller-supplied family is resolved through a tenant-scoped query and
    // never trusted from the body. Rejected as a 400 rather than silently
    // falling back to the default: an HR user who picked a form and got a
    // different one has been misled about what they launched.
    let template;
    if (req.body.templateFamily) {
      if (!mongoose.Types.ObjectId.isValid(req.body.templateFamily)) {
        return res.status(400).json({
          success: false,
          message: 'That appraisal form could not be found, or has been archived.',
        });
      }
      template = await AppraisalTemplate.findOne({
        tenant: req.tenant._id,
        family: req.body.templateFamily,
        isLatest: true,
        isArchived: false,
      });
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'That appraisal form could not be found, or has been archived.',
        });
      }
    } else {
      template = await ensureDefaultTemplate(req.tenant._id, req.user._id);
    }
    const cycle = await AppraisalCycle.create({
      tenant: req.tenant._id,
      name: String(name).trim(),
      template: template._id,
      templateFamily: template.family,
      status: 'draft',
      nominationDeadline,
      feedbackDeadline,
      // Passed through raw on purpose: Mongoose's Boolean cast already maps
      // "false"/"0"/"no" to false and leaves `undefined` alone so the schema
      // default (true) applies. A hand-rolled `=== false` guard here would
      // send a string "false" — what an HTML form post or a non-JSON client
      // sends — down the true branch, silently launching a full 360 for an HR
      // user who asked for a self-and-manager-only cycle.
      peerReviewEnabled,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

exports.getCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    res.json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

/**
 * Fan the cycle out into one Appraisal per in-scope employee, plus the self and
 * manager feedback rows. Each employee's appraisal + feedback pair is created
 * inside its own transaction, so a given employee either ends up with both the
 * Appraisal and its two feedback rows, or with neither — never an Appraisal
 * stranded without feedback rows to complete it. Idempotent: re-launching skips
 * employees who already have a (fully-committed) appraisal for this cycle, so a
 * partial failure — the process dying between employees — can simply be
 * retried; the employee that was mid-transaction when it died rolled back
 * entirely and will be picked up again on retry.
 */
exports.launchCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    });
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });
    if (cycle.status === 'closed' || cycle.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Cannot launch a ${cycle.status} cycle` });
    }

    // Pin the concrete template version, once. A cycle still in draft picks up
    // any edit made since it was created; a cycle that has already launched
    // keeps the exact version its in-flight appraisals were written against.
    // `launchedAt` is the marker, not `status`: re-launching to pick up newly
    // added employees is an idempotent, supported action and must not move the
    // existing appraisals onto a newer form.
    //
    // Deliberately NOT filtered on `isArchived`: archiving means "do not offer
    // this form for new cycles" and does not affect reads. A draft cycle whose
    // family was archived after it was created is already pinned to a version
    // of that same archived family, so refusing to re-resolve would only pin an
    // older revision of the very same form.
    if (!cycle.launchedAt && cycle.templateFamily) {
      const latest = await AppraisalTemplate.findOne({
        tenant: req.tenant._id,
        family: cycle.templateFamily,
        isLatest: true,
      }).select('_id');
      if (latest) cycle.template = latest._id;
    }

    const scope = Array.isArray(req.body.employeeIds) && req.body.employeeIds.length
      ? { _id: { $in: req.body.employeeIds } }
      : {};
    const employees = await User.find({
      tenant: req.tenant._id,
      role: { $in: TENANT_ROLES },
      status: 'active',
      ...scope,
    }).select('_id employeeProfile.work.manager').lean();

    const existing = await Appraisal.find({ tenant: req.tenant._id, cycle: cycle._id })
      .select('employee').lean();

    const plan = planCycleLaunch(employees, existing.map((a) => a.employee));

    // planCycleLaunch returns bare ids; HR cannot chase an ObjectId. Resolve
    // them here rather than in the helper, which stays DB-free by design.
    const skippedIds = plan.skipped.map((s) => s.employee);
    const skippedUsers = skippedIds.length
      ? await User.find({ _id: { $in: skippedIds }, tenant: req.tenant._id })
          .select('firstName lastName email').lean()
      : [];
    const byId = new Map(skippedUsers.map((u) => [String(u._id), u]));
    const skipped = plan.skipped.map((s) => ({
      reason: s.reason,
      employee: byId.get(String(s.employee)) || { _id: s.employee },
    }));

    // Peer review on → the employee nominates first. Off → Phase 1's path,
    // straight to collecting, kept live rather than left as dead code.
    const launchState = cycle.peerReviewEnabled === false ? 'collecting' : 'nominating';

    const created = [];
    for (const { employee, manager } of plan.toCreate) {
      const session = await mongoose.startSession();
      try {
        // Assigned inside the callback and pushed only after the transaction
        // commits. withTransaction re-runs its WHOLE callback on a transient
        // error, so a `created.push()` inside it counted the same employee
        // once per attempt and reported an inflated `created: N` to HR. The
        // same closure-mutation hazard cost this module a silent feedback-row
        // loss in applyPeerDecisions — mutate nothing that outlives an attempt.
        let createdId = null;
        await session.withTransaction(async () => {
          const [appraisal] = await Appraisal.create([{
            tenant: req.tenant._id,
            cycle: cycle._id,
            employee,
            manager,
            state: launchState,
            reviewerIds: [employee, manager],
          }], { session });
          await AppraisalFeedback.insertMany([
            { tenant: req.tenant._id, appraisal: appraisal._id, cycle: cycle._id, reviewer: employee, kind: 'self' },
            { tenant: req.tenant._id, appraisal: appraisal._id, cycle: cycle._id, reviewer: manager, kind: 'manager' },
          ], { session });
          createdId = appraisal._id;
        });
        if (createdId) created.push(createdId);
      } finally {
        session.endSession();
      }
    }

    cycle.status = 'collecting';
    cycle.launchedAt = cycle.launchedAt || new Date();
    await cycle.save();

    res.json({
      success: true,
      data: {
        created: created.length,
        alreadyExisted: plan.alreadyExists.length,
        skipped,
      },
    });
  } catch (err) { next(err); }
};

exports.closeCycle = async (req, res, next) => {
  try {
    const cycle = await AppraisalCycle.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    });
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    // Guard the status here, not only in the UI. The previous
    // findOneAndUpdate closed unconditionally, so re-closing an already-closed
    // cycle overwrote its original closedAt with a later date — quietly
    // falsifying when the review period actually ended.
    if (cycle.status === 'closed' || cycle.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot close a ${cycle.status} cycle`,
      });
    }

    cycle.status = 'closed';
    cycle.closedAt = new Date();
    await cycle.save();

    // Feedback still outstanding at close is expired, not silently left pending.
    await AppraisalFeedback.updateMany(
      { tenant: req.tenant._id, cycle: cycle._id, status: 'pending' },
      { $set: { status: 'expired' } }
    );
    res.json({ success: true, data: cycle });
  } catch (err) { next(err); }
};

exports.cycleProgress = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle id' });
    }
    const cycleId = new mongoose.Types.ObjectId(req.params.id);
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);
    const filter = { tenant: req.tenant._id, cycle: req.params.id };

    // No .catch(() => []) here: an aggregate failure must surface as a 500,
    // not be reported as "zero appraisals in every state" — that would look
    // like a legitimately empty cycle instead of a broken query.
    const [cycle, appraisals, feedbackTotal, feedbackSubmitted] = await Promise.all([
      AppraisalCycle.findOne({ _id: cycleId, tenant: tenantId }).lean(),
      Appraisal.aggregate([
        { $match: { tenant: tenantId, cycle: cycleId } },
        { $group: { _id: '$state', count: { $sum: 1 } } },
      ]),
      AppraisalFeedback.countDocuments(filter),
      AppraisalFeedback.countDocuments({ ...filter, status: 'submitted' }),
    ]);

    // 404 like every sibling handler (getCycle/launchCycle/closeCycle). This
    // used to answer 200 with zeroes for an unknown id or one belonging to
    // another tenant, which made "this cycle has not been launched yet"
    // indistinguishable from "that cycle does not exist" — the dashboard had
    // no way to tell an empty cycle from a bad link.
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const byState = {};
    for (const row of appraisals) byState[row._id] = row.count;

    // Nomination adds two new ways to stall: nobody nominated, or the manager
    // never approved. Surfaced with names because the whole point is that HR
    // can then act on behalf or skip peers. Nothing auto-advances — a silent
    // state change on a performance record is hard to explain to its subject.
    const stalled = cycle.nominationDeadline && cycle.nominationDeadline < new Date()
      ? (await Appraisal.find({
          tenant: req.tenant._id,
          cycle: cycle._id,
          state: { $in: ['nominating', 'pending_peer_approval'] },
        })
          .populate('employee', 'firstName lastName email')
          .populate('manager', 'firstName lastName email')
          .select('state updatedAt employee manager')
          .lean()
        ).map((a) => ({
          _id: a._id, state: a.state, since: a.updatedAt,
          employee: a.employee, manager: a.manager,
        }))
      : [];

    res.json({
      success: true,
      data: { byState, feedbackTotal, feedbackSubmitted, stalled },
    });
  } catch (err) { next(err); }
};

// Spreading a hydrated mongoose document yields {$__, _doc}, not schema paths,
// so a projection built on the spread would silently strip nothing. Everything
// below reads via .lean(), but the guard costs nothing and this has been a real
// bug in this module twice.
const plainDoc = (d) => (
  d && typeof d.toObject === 'function' && !(d instanceof mongoose.Types.ObjectId)
    ? d.toObject()
    : d
);

/**
 * A person as the roster shows them. An unpopulated ref collapses to `{_id}`
 * rather than a bare ObjectId so the UI never has to branch on the shape —
 * HR cannot chase an ObjectId, which is why launchCycle's `skipped` was fixed
 * the same way in Phase 2.
 */
function rosterPerson(ref) {
  const p = plainDoc(ref);
  if (p == null) return null;
  if (p.firstName === undefined && p.lastName === undefined && p.email === undefined) {
    return { _id: p._id ?? p };
  }
  return {
    _id: p._id,
    firstName: p.firstName ?? null,
    lastName: p.lastName ?? null,
    email: p.email ?? null,
    jobTitle: p.employeeProfile?.work?.jobTitle ?? null,
  };
}

const personSortKey = (p) => `${p?.lastName || ''} ${p?.firstName || ''}`.trim().toLowerCase();

/**
 * The per-employee view of a cycle. Deliberately a separate endpoint from
 * /progress, which stays a cheap counts payload: the roster is the expensive
 * read and only the dashboard's roster tab needs it.
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────
 * `outstanding` names peer reviewers, because outstandingActionsFor returns
 * every pending reviewer in the 'collecting' state and chasing a peer means
 * naming them. The module's rule is that the manager and HR see peer names
 * and only the employee (the subject) does not. This handler therefore has
 * no business being reachable by a subject, and it carries NO role check of
 * its own — its mount point is the boundary. It is registered on
 * `cycleRouter`, which is `.use(tenantAdminOrSuperAdmin)`-gated; the sibling
 * `appraisalRouter` deliberately is not, because tenant_staff must reach
 * their own record. Moving this route there would hand every employee the
 * peer roster of their own 360. appraisalCycleRoster.test.js asserts the
 * mount point and the gate ordering for exactly that reason.
 */
exports.cycleRoster = async (req, res, next) => {
  try {
    // A malformed id must be a 400, not the 500 a CastError would become —
    // server.js's handler translates ValidationError only and deliberately
    // leaves CastError alone. Same guard as cycleProgress.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle id' });
    }
    const cycleId = new mongoose.Types.ObjectId(req.params.id);
    // Tenant scoping in this codebase is req.tenant._id; req.tenantId does not
    // exist. A missing tenant must NOT be allowed to reach a query filter —
    // mongoose strips `undefined` out of a filter, so {tenant: undefined}
    // silently becomes {} and matches every row in the database.
    if (!req.tenant?._id) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);

    const cycle = await AppraisalCycle.findOne({ _id: cycleId, tenant: tenantId }).lean();
    // 404 like every sibling handler, so a bad link is distinguishable from
    // an empty cycle.
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const page = Math.max(1, Number(req.query?.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query?.limit) || 50));

    // One read for the whole cycle's appraisals. `populate` issues one batched
    // query per path regardless of cycle size, so this is 2 queries, not N+1 —
    // and paging is applied after the sort because the spec's ordering is by
    // employee NAME, which lives on the populated ref and cannot be sorted on
    // in the database without a $lookup pipeline.
    const all = await Appraisal.find({ tenant: tenantId, cycle: cycle._id })
      .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
      .populate('manager', 'firstName lastName email')
      .sort({ state: 1, createdAt: 1 })
      .lean();

    // Array.prototype.sort is stable, so the createdAt order above survives as
    // the tiebreak within a (state, name) group.
    const ordered = [...all].sort((a, b) => {
      const byState = String(a.state || '').localeCompare(String(b.state || ''));
      if (byState !== 0) return byState;
      return personSortKey(a.employee).localeCompare(personSortKey(b.employee));
    });

    const total = ordered.length;
    const pageRows = ordered.slice((page - 1) * limit, (page - 1) * limit + limit);

    // One read for every feedback row on the page's appraisals, grouped in
    // memory — the third and last query. Tenant-scoped as well as
    // appraisal-scoped: an appraisal id is not a tenant boundary on its own.
    const ids = pageRows.map((a) => a._id);
    const feedbackRows = ids.length
      ? await AppraisalFeedback.find({ tenant: tenantId, appraisal: { $in: ids } })
          .select('appraisal reviewer kind status submittedAt')
          .populate('reviewer', 'firstName lastName email')
          .lean()
      : [];

    // Group strictly by appraisal id. A slip here has HR chasing someone who
    // has already done their part on this record — which is why
    // outstandingActionsFor carries its own cross-appraisal guard too.
    const byAppraisal = new Map(ids.map((id) => [String(id), []]));
    for (const r of feedbackRows) {
      const bucket = byAppraisal.get(String(r.appraisal && r.appraisal._id ? r.appraisal._id : r.appraisal));
      if (bucket) bucket.push(r);
    }

    // Nudge history for the page's appraisals — the fourth and last query.
    // Nudges are a separate collection precisely so a reviewer id never lands
    // on the Appraisal document the subject reads; this roster is HR-only (see
    // the mount-point note above), so surfacing the target here is fine.
    const nudges = ids.length
      ? await AppraisalNudge.find({ tenant: tenantId, appraisal: { $in: ids } })
          .select('appraisal target reason channel sentAt')
          .sort({ sentAt: -1 })
          .lean()
      : [];
    const latestNudge = new Map();
    for (const n of nudges) {
      // Sorted newest-first, so the first seen per appraisal is the latest.
      if (!latestNudge.has(String(n.appraisal))) latestNudge.set(String(n.appraisal), n);
    }

    const rows = pageRows.map((a) => {
      const fb = byAppraisal.get(String(a._id)) || [];
      const peers = fb.filter((f) => f.kind === 'peer');
      const self = fb.find((f) => f.kind === 'self') || null;
      const mgr = fb.find((f) => f.kind === 'manager') || null;

      // Resolve outstanding targets to people. The reviewer refs are already
      // populated on the feedback rows; employee/manager come off the
      // appraisal.
      const people = new Map();
      if (a.employee) people.set(String(plainDoc(a.employee)?._id ?? a.employee), a.employee);
      if (a.manager) people.set(String(plainDoc(a.manager)?._id ?? a.manager), a.manager);
      for (const r of fb) {
        if (!r.reviewer) continue;
        people.set(String(plainDoc(r.reviewer)?._id ?? r.reviewer), r.reviewer);
      }

      return {
        _id: a._id,
        state: a.state,
        employee: rosterPerson(a.employee),
        manager: rosterPerson(a.manager),
        self: self ? { status: self.status, submittedAt: self.submittedAt ?? null } : null,
        mgr: mgr ? { status: mgr.status, submittedAt: mgr.submittedAt ?? null } : null,
        peers: {
          // The single definition of "an approved peer" — never re-filter the
          // nominations array here. Three longhand copies is the bug this
          // helper was extracted to prevent.
          approved: countApprovedPeers(a),
          submitted: peers.filter((p) => p.status === 'submitted').length,
          declined: peers.filter((p) => p.status === 'declined').length,
          pending: peers.filter((p) => p.status === 'pending').length,
        },
        outstanding: outstandingActionsFor(a, fb).map((o) => ({
          reason: o.reason,
          target: rosterPerson(people.get(String(o.target))) || { _id: o.target },
        })),
        lastNudge: latestNudge.get(String(a._id)) || null,
      };
    });

    res.json({ success: true, data: { rows, page, limit, total } });
  } catch (err) { next(err); }
};

// Which reviewer kinds get their own column. A fixed whitelist rather than
// bucketing on whatever string the row carries: `acc[row.kind]` on a plain
// object would otherwise happily resolve `constructor` or `toString`.
const REPORT_KINDS = ['self', 'manager', 'peer'];

/**
 * Cycle-wide reporting: how ratings landed, not who is outstanding.
 *
 * HR-only BY MOUNT POINT — this lives on cycleRouter, which is
 * `.use(tenantAdminOrSuperAdmin)`-gated. It must not move to appraisalRouter,
 * which is deliberately ungated so staff can reach their own record.
 *
 * Even so the payload carries no reviewer identity at all — only counts and
 * means — so the module's privacy asymmetry (manager and HR see peer names,
 * the subject never does) is not something this endpoint can widen.
 *
 * No small-n suppression, deliberately, and this is the opposite call from
 * buildComparison's PEER_RELEASE_MIN gate. That gate protects the SUBJECT,
 * who must not be able to back a single peer's score out of a mean. Here the
 * only reader is HR, who can already open every appraisal in its own tenant;
 * suppressing would hide nothing it cannot read one click away while making
 * the report quietly wrong. `n` ships on every bucket so the UI can caveat a
 * thin one. Stated for the same reason: in a cycle with one released
 * appraisal the "cycle mean" IS that person's score — worth knowing before
 * anyone reads a two-person histogram as a trend.
 *
 * Labels resolve against the cycle's PINNED template version, which is only
 * unambiguous because launchCycle freezes it — an unpinned cycle would label
 * historical answers with whatever the form says today.
 *
 * Three queries flat (cycle, then template + appraisals + feedback in
 * parallel), reduced in memory. Not an aggregation pipeline: a cycle can hold
 * every employee but the rows are small, and the reduction below is testable
 * where a $unwind/$group is not.
 */
exports.cycleReport = async (req, res, next) => {
  try {
    // A malformed id must be a 400, not the 500 a CastError would become —
    // server.js's handler translates ValidationError only and deliberately
    // leaves CastError alone. Same guard as cycleProgress/cycleRoster.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle id' });
    }
    // Tenant scoping in this codebase is req.tenant._id; req.tenantId does not
    // exist. A missing tenant must NOT reach a query filter — mongoose strips
    // `undefined` out, so {tenant: undefined} matches every row in the DB.
    if (!req.tenant?._id) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }
    const cycleId = new mongoose.Types.ObjectId(req.params.id);
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);

    const cycle = await AppraisalCycle.findOne({ _id: cycleId, tenant: tenantId }).lean();
    // 404 like every sibling handler, so a bad link is distinguishable from a
    // cycle with nothing in it yet.
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found' });

    const [template, released, submitted] = await Promise.all([
      // Guarded on cycle.template being present for the same reason as the
      // tenant guard above: findOne({_id: undefined, tenant}) is stripped down
      // to {tenant} and would return an ARBITRARY template, labelling this
      // cycle's answers with a form it never used.
      cycle.template
        ? AppraisalTemplate.findOne({ _id: cycle.template, tenant: tenantId }).lean()
        : null,
      Appraisal.find({
        tenant: tenantId,
        cycle: cycle._id,
        state: { $in: ['released', 'acknowledged'] },
      }).select('state finalRating').lean(),
      // Tenant-scoped as well as cycle-scoped: a cycle id is not a tenant
      // boundary on its own.
      AppraisalFeedback.find({
        tenant: tenantId, cycle: cycle._id, status: 'submitted',
      }).select('kind answers').lean(),
    ]);

    // Histogram over the final ratings that EXIST. An appraisal released
    // without one still counts as released, but inventing a 0 bucket for it
    // would fabricate a bad review — so the histogram counts need not sum to
    // releasedCount.
    const counts = new Map();
    for (const a of released) {
      if (typeof a.finalRating !== 'number' || Number.isNaN(a.finalRating)) continue;
      counts.set(a.finalRating, (counts.get(a.finalRating) || 0) + 1);
    }
    const finalRatingHistogram = [...counts.entries()]
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => a.rating - b.rating);

    // Accumulate per (questionId, kind). Only rating answers — a text answer
    // has no mean, and the template is the authority on which is which.
    const acc = new Map();
    for (const row of submitted) {
      if (!REPORT_KINDS.includes(row.kind)) continue;
      for (const a of row.answers || []) {
        if (typeof a.rating !== 'number' || Number.isNaN(a.rating)) continue;
        const key = String(a.questionId);
        if (!acc.has(key)) acc.set(key, { self: [], manager: [], peer: [] });
        acc.get(key)[row.kind].push(a.rating);
      }
    }

    const mean = (xs) => (
      xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null
    );
    // Denominator is the number of SUBMITTED answers carrying a numeric rating
    // for THIS question and THIS kind — not the reviewer count and not the
    // appraisal count. A reviewer who skipped an optional question is absent
    // from that row's n rather than counted as a zero.
    const stat = (xs) => ({ mean: mean(xs), n: xs.length });

    // Driven by the template, never by the answers: means stay per question,
    // so questions on different scaleMax values are never pooled and never
    // rescaled — a mean of 4/5 and 9/10 is arithmetic on two different units.
    // scaleMax rides along so the UI can render "3.5 / 5". An answer whose
    // questionId is not in the pinned template is dropped rather than rendered
    // under a fabricated label; version pinning should make that unreachable,
    // but "unreachable" is a claim about today's code.
    const questionStats = [];
    for (const section of template?.sections || []) {
      for (const q of section.questions || []) {
        if (q.type !== 'rating') continue;
        const bucket = acc.get(String(q._id)) || { self: [], manager: [], peer: [] };
        questionStats.push({
          questionId: q._id,
          sectionTitle: section.title,
          label: q.label,
          scaleMax: q.scaleMax,
          self: stat(bucket.self),
          manager: stat(bucket.manager),
          peer: stat(bucket.peer),
        });
      }
    }

    res.json({
      success: true,
      data: { releasedCount: released.length, finalRatingHistogram, questionStats },
    });
  } catch (err) { next(err); }
};
