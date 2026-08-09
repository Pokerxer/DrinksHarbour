// server/controllers/appraisal.controller.js — subject + manager facing
//
// Every single-record read and write in this file resolves access through
// resolveAppraisalAccess before doing anything else. No handler here rolls
// its own role/ownership check — that centralisation is what keeps the
// module's security guarantees true across endpoints as it grows.
const mongoose = require('mongoose');
const Appraisal = require('../models/Appraisal');
const AppraisalFeedback = require('../models/AppraisalFeedback');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalNudge = require('../models/AppraisalNudge');
const User = require('../models/User');
// Required as a namespace, not destructured: the nudge tests swap
// `emailService.sendAppraisalNudgeEmail` out at runtime, which a destructured
// binding captured at require time would never see.
const emailService = require('../services/email.service');
const {
  resolveAppraisalAccess,
  projectFeedbackForViewer,
  orderFeedbackForViewer,
  assertTransition,
  nominationViewForSubject,
  validateNominations,
  effectiveNominationMin,
  applyNominationDecisions,
  planPeerRowCreation,
  countApprovedPeers,
  peerReleaseGate,
  outstandingActionsFor,
  buildComparison,
  scoreAppraisal,
  normaliseCommitments,
  filterSections,
  TENANT_ROLES,
} = require('../services/appraisal.helpers');
const { departmentScopeFor } = require('../services/appraisalScope.service');
const {
  deletedEmployeeIdsFor, excludeDeleted,
} = require('../services/appraisalRoster.service');

/**
 * Resolve access, WITH the caller's department scope (Phase 5 §9.4).
 *
 * Every single-record handler in this file goes through here rather than
 * calling resolveAppraisalAccess directly, because the resolver fails closed
 * for a `tenant_admin` when no scope is supplied — so a handler that called it
 * bare would 403 its own admins rather than leak, but would still be wrong.
 * One function, memoised per request by departmentScopeFor, means one query
 * however many times a handler resolves access.
 */
async function accessFor(req, appraisal) {
  const departmentScope = await departmentScopeFor(req);
  return resolveAppraisalAccess(req.user, appraisal, { departmentScope });
}

// How long a reminder silences the next identical one. Mostly about a
// double-click sending two emails, and about a stalled appraisal not becoming
// a week of daily mail for someone on leave.
//
// Lives here rather than in appraisal.helpers.js only because that file was
// frozen at the end of Task 7; NUDGE_REASONS (its natural neighbour) is there.
// Exported so the tests and the roster UI read one number, not two.
const NUDGE_MIN_INTERVAL_HOURS = 12;
const NUDGE_CHANNELS = ['app', 'email'];

// Appraisal-document fields that only become visible to the subject once
// resolveAppraisalAccess actually grants them canRead (state 'released' or
// 'acknowledged'). summary/finalRating are written by the manager/HR during
// 'summarising' — well before release — so leaving them on this list would
// let a subject read their own verdict early via GET /my even though GET
// /:id correctly blocks them. employeeResponse is included for symmetry,
// though it can only exist once the subject themselves acknowledged.
const EARLY_APPRAISAL_FIELDS = ['summary', 'finalRating', 'employeeResponse'];

// Fields that identify who is reviewing/reviewed-by whom outside of the
// per-feedback-row `reviewer` field that projectFeedbackForViewer already
// guards. The appraisal document denormalises reviewerIds and peerNominations
// for query convenience, but a subject who cannot see reviewer names must not
// learn them this way either — leaving these on the payload would defeat
// feedback-level anonymity.
const REVIEWER_IDENTITY_FIELDS = ['reviewerIds', 'peerNominations'];

// Mirrors projectFeedbackForViewer's pattern (appraisal.helpers.js): a
// hydrated Mongoose document keeps its schema paths on prototype getters, so
// `{ ...doc }` only ever copies the internal `$__`/`_doc` own properties —
// none of the actual fields, and none of the keys this function is asked to
// delete. Calling `.toObject()` first (when present) flattens it to a plain
// object with the real fields as own properties, exactly like a `.lean()`
// result, so `delete` actually removes the sensitive keys either way.
function omit(obj, keys) {
  const plain = typeof obj?.toObject === 'function' ? obj.toObject() : { ...obj };
  for (const key of keys) delete plain[key];
  return plain;
}

/**
 * Sanitise one row of the caller's own appraisal list. The subject relation
 * always has canSeeReviewerNames === false (see resolveAppraisalAccess), so
 * reviewer-identity fields are stripped unconditionally; the early-verdict
 * fields are stripped unless the appraisal has actually reached a state the
 * subject is entitled to read.
 */
function sanitizeOwnAppraisalRow(row) {
  const released = row.state === 'released' || row.state === 'acknowledged';
  const withoutIdentity = omit(row, REVIEWER_IDENTITY_FIELDS);
  return released ? withoutIdentity : omit(withoutIdentity, EARLY_APPRAISAL_FIELDS);
}

/**
 * Strip reviewer-identifying fields from the appraisal document itself for a
 * viewer who may not see reviewer names — the document-level counterpart to
 * projectFeedbackForViewer, which only guards individual feedback rows.
 */
function projectAppraisalForViewer(appraisal, access) {
  if (access?.canSeeReviewerNames) return appraisal;
  return omit(appraisal, REVIEWER_IDENTITY_FIELDS);
}

// Whether a nudge's reason still describes work the appraisal is actually
// waiting on. The spec surfaces a reminder "only while that action is still
// outstanding"; keyed on appraisal.state so it costs no extra query, and
// mirrors outstandingActionsFor's state machine rather than restating it in a
// way that could drift into showing an acknowledge nag after acknowledgement.
const NUDGE_STILL_OUTSTANDING = {
  nominate: (state) => state === 'nominating',
  approve_peers: (state) => state === 'pending_peer_approval',
  feedback: (state) => state === 'collecting',
  summarise: (state) => state === 'collecting' || state === 'summarising',
  acknowledge: (state) => state === 'released',
};

/**
 * Batched, caller-scoped nudge lookup for the two "my ..." list endpoints.
 *
 * Two invariants, both load-bearing:
 *
 *  1. `target: req.user._id` — a nudge is scoped to the person it was sent to.
 *     Showing someone else's reminder would tell the caller that that person
 *     was chased, which is not theirs to know. On `myAppraisals` (the SUBJECT's
 *     own view) that would also be a direct breach of the module's anonymity
 *     asymmetry, since the outstanding party is typically a peer reviewer.
 *  2. One `$in` query for the whole page, joined in memory. These are list
 *     endpoints; a per-row lookup is an N+1.
 *
 * Returns a lookup that yields `{sentAt, reason}` or `undefined`. Deliberately
 * NOT `null`: the caller attaches the key only when a nudge exists, so an
 * un-nudged payload carries no `nudge` field at all — which is what keeps
 * Task 9's guard (the subject's payload contains no occurrence of 'nudge')
 * meaningful instead of trivially violated by a placeholder on every row.
 */
async function loadNudgeLookup(req, appraisalIds) {
  const ids = [...new Map(
    (appraisalIds || []).filter(Boolean).map((id) => [String(id), id]),
  ).values()];
  if (!ids.length) return () => undefined;

  const nudgeRows = await AppraisalNudge.find({
    tenant: req.tenant._id,
    target: req.user._id,
    appraisal: { $in: ids },
  })
    .select('appraisal reason sentAt')
    .sort({ sentAt: -1 })
    .lean();

  // Newest first, so the first row seen per appraisal is the current one —
  // repeat nudges are kept as history and must not each render a card.
  const latest = new Map();
  for (const n of nudgeRows) {
    const key = String(n.appraisal);
    if (!latest.has(key)) latest.set(key, n);
  }

  return (appraisalId, state) => {
    const n = appraisalId && latest.get(String(appraisalId));
    if (!n) return undefined;
    const stillOpen = NUDGE_STILL_OUTSTANDING[n.reason];
    if (stillOpen && !stillOpen(state)) return undefined;
    // Two fields only. `sentBy` is HR's identity and not the point; `target`
    // is redundant here (it is always the caller) and is exactly the kind of
    // field that gets widened later without anyone noticing, on a payload
    // whose sanitiser is a deny-list.
    return { sentAt: n.sentAt, reason: n.reason };
  };
}

exports.myAppraisals = async (req, res, next) => {
  try {
    const rows = await Appraisal.find({ tenant: req.tenant._id, employee: req.user._id })
      .populate('cycle', 'name feedbackDeadline status')
      .sort({ createdAt: -1 })
      .lean();

    // Do not return the full document here: an unreleased appraisal's
    // summary/finalRating/employeeResponse and reviewer identities must stay
    // hidden from the subject exactly as they would be from GET /:id.
    const nudgeFor = await loadNudgeLookup(req, rows.map((r) => r._id));

    // Attached AFTER sanitisation, on purpose: sanitizeOwnAppraisalRow is a
    // deny-list, so anything it does not know about survives it anyway. Doing
    // it in this order keeps the sanitiser operating on exactly the document
    // shape it was written against.
    res.json({
      success: true,
      data: rows.map((row) => {
        const safe = sanitizeOwnAppraisalRow(row);
        const nudge = nudgeFor(row._id, row.state);
        return nudge ? { ...safe, nudge } : safe;
      }),
    });
  } catch (err) { next(err); }
};

exports.myReviewRequests = async (req, res, next) => {
  try {
    const [all, deletedIds] = await Promise.all([
      AppraisalFeedback.find({
        tenant: req.tenant._id,
        reviewer: req.user._id,
        status: { $in: ['pending', 'submitted'] },
      })
        .populate({
          path: 'appraisal',
          select: 'employee state',
          populate: { path: 'employee', select: 'firstName lastName email' },
        })
        .populate('cycle', 'name feedbackDeadline')
        .sort({ createdAt: -1 })
        .lean(),
      deletedEmployeeIdsFor(req),
    ]);

    // Filtered here rather than in the query: the live-employee rule is about
    // the appraisal's SUBJECT, and a feedback row records only its reviewer, so
    // the query has nothing to match on. `appraisal` is already populated, and
    // its `employee` with it, so this costs no extra read.
    const deleted = new Set(deletedIds.map(String));
    const subjectOf = (row) => {
      const emp = row.appraisal && row.appraisal.employee;
      return String((emp && emp._id) || emp || '');
    };
    const rows = deleted.size ? all.filter((row) => !deleted.has(subjectOf(row))) : all;

    // `appraisal` is populated, so the id is one level down — and may be null
    // if the referenced appraisal is gone. idsOf drops the empties rather than
    // letting `undefined` reach the filter: mongoose strips undefined out of a
    // query, which would turn the $in into "every nudge in the tenant".
    const nudgeFor = await loadNudgeLookup(
      req,
      rows.map((r) => (r.appraisal && r.appraisal._id) || r.appraisal),
    );

    res.json({
      success: true,
      data: rows.map((row) => {
        const appraisalId = (row.appraisal && row.appraisal._id) || row.appraisal;
        const nudge = nudgeFor(appraisalId, row.appraisal && row.appraisal.state);
        // A reviewer learning THEY were nudged is fine; the row's own status is
        // a sharper "still outstanding" signal than the appraisal state, since
        // this list also returns work the caller has already submitted.
        if (!nudge || (nudge.reason === 'feedback' && row.status !== 'pending')) return row;
        return { ...row, nudge };
      }),
    });
  } catch (err) { next(err); }
};

exports.teamAppraisals = async (req, res, next) => {
  try {
    // A report who has been removed from the tenant drops off their manager's
    // list. The appraisal is not deleted — restoring the employee restores the
    // row — but nobody can complete a review of someone who can no longer sign
    // in, and leaving it here reads as work still owed.
    const rows = await Appraisal.find({
      tenant: req.tenant._id,
      manager: req.user._id,
      ...excludeDeleted(await deletedEmployeeIdsFor(req)),
    })
      .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
      .populate('cycle', 'name feedbackDeadline status')
      .sort({ createdAt: -1 })
      .lean();
    // No projection needed: resolveAppraisalAccess gives the manager relation
    // canSeeReviewerNames + canRead unconditionally on their own reports'
    // appraisals, so there is nothing here they are not already entitled to.
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate('employee', 'firstName lastName email employeeProfile.work.jobTitle')
      .populate('manager', 'firstName lastName email')
      .populate('cycle', 'name feedbackDeadline status template')
      .lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canRead) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    // Feedback rows only carry `answers: [{ questionId, rating, text }]` — the
    // question's label/type/scaleMax live on the template, not the row. Every
    // viewer who reaches this point (subject once released, manager, hr) needs
    // those labels to make sense of the answers, so the template's sections
    // are resolved here and returned alongside the feedback. Sections are
    // returned in full (every askOf kind), not filtered to one reviewer kind
    // the way appraisalFeedback.controller.js#loadAskedSections does for a
    // single reviewer's own form — a manager/hr viewer legitimately reads
    // self, manager and (Phase 2) peer answers side by side, so filtering
    // here would hide questions they are entitled to see.
    const cycle = appraisal.cycle;
    if (!cycle || !cycle.template) {
      const err = new Error('The appraisal cycle for this appraisal could not be found.');
      err.status = 500;
      err.expose = true;
      throw err;
    }
    const template = await AppraisalTemplate.findOne({
      _id: cycle.template,
      tenant: req.tenant._id,
    }).lean();
    if (!template) {
      const err = new Error('The appraisal template for this appraisal could not be found.');
      err.status = 500;
      err.expose = true;
      throw err;
    }
    const sections = template.sections || [];

    // `tenant` is redundant today — `appraisal._id` was already tenant-scoped
    // above, so these rows are only reachable through a checked parent — but
    // every other query in this module re-asserts it, and leaving it off here
    // makes this the one place a future refactor could widen without noticing.
    // Declined rows are only ever added to the result for a viewer who can
    // act on them (canBackfillPeers, i.e. manager/hr while `collecting`) —
    // Task 13's backfill panel needs to know WHICH peer declined so it can
    // offer a replacement, which 'submitted'-only never surfaced. Anyone else
    // (including the subject, always canBackfillPeers: false) keeps getting
    // exactly the 'submitted' set this endpoint always returned, so this is
    // additive for one relation/state combination rather than a behaviour
    // change for the rest.
    const rawFeedback = await AppraisalFeedback.find({
      tenant: req.tenant._id,
      appraisal: appraisal._id,
      status: access.canBackfillPeers ? { $in: ['submitted', 'declined'] } : 'submitted',
    })
      .populate('reviewer', 'firstName lastName email')
      .lean();

    // Anonymity is applied here, once, for every caller — to the feedback
    // rows via projectFeedbackForViewer, and to the appraisal document's own
    // reviewer-identifying fields via projectAppraisalForViewer.
    // Anonymity is two things, not one: WHAT each row says about its author
    // (projectFeedbackForViewer strips `reviewer`) and WHERE the row sits.
    // Peer rows come back in natural order, which is creation order, which is
    // the order the subject's own nominations were approved — so an anonymous
    // list still ranked itself for them. orderFeedbackForViewer reorders peer
    // rows under a per-appraisal salted hash for anyone who may not see names.
    // Peer rows are dropped ENTIRELY for a viewer without canSeePeerFeedback —
    // in practice the subject — before anything else touches them. Removing
    // the row beats anonymising it: stripping `reviewer` leaves the prose,
    // and prose identifies its author to anyone who works with them. The
    // employee gets peer input through the manager's summary instead.
    //
    // Done here, upstream of BOTH the projection and buildComparison, so the
    // subject's `comparison` loses its peer column by construction rather than
    // by a gate someone could later get wrong. There is no code path from a
    // subject request to a peer answer left to audit.
    const visibleFeedback = access.canSeePeerFeedback
      ? rawFeedback
      : rawFeedback.filter((fb) => fb.kind !== 'peer');

    const feedback = orderFeedbackForViewer(
      visibleFeedback.map((fb) => projectFeedbackForViewer(fb, access)),
      appraisal._id,
      access
    );
    const safeAppraisal = projectAppraisalForViewer(appraisal, access);

    // Built from the PROJECTED feedback, never the raw rows — the order of
    // these two lines is the guarantee, not a style choice. For a subject
    // viewer projectFeedbackForViewer has already removed each peer row's
    // `reviewer` and stripped `answers` from anything not submitted, so
    // `peerBreakdown` cannot populate even if its own access gate were wrong.
    // Two independent reasons, one of them structural; swap the argument for
    // `rawFeedback` and only the gate is left standing.
    const comparison = buildComparison(sections, feedback, access);

    // Told to every viewer including the subject: the employee is the one
    // person who otherwise cannot tell a 360 built on one response from one
    // built on four, and they are the one being judged by it.
    const approvedPeerCount = countApprovedPeers(appraisal);
    // Explicitly 'submitted' rather than "every peer row now in `feedback`":
    // when canBackfillPeers admitted declined rows above, counting them here
    // too would inflate this past the number of peers who actually responded.
    // Counted off rawFeedback, NOT the projected `feedback` array: the subject
    // no longer receives peer rows at all, so counting the visible ones would
    // report 0 to the one viewer this number exists for. They cannot read the
    // peer input, which is exactly why they must be told how much of it the
    // summary rests on — a summary built on one response looks identical to
    // one built on four.
    const peerResponseCount = rawFeedback.filter(
      (fb) => fb.kind === 'peer' && fb.status === 'submitted'
    ).length;

    // The appraisal's final score, from the manager's assessment — the form is
    // a supervisor's rating sheet, so the manager's row is the one that counts
    // and self/peer answers are input to it, not votes in it.
    //
    // Computed from the PROJECTED `feedback`, exactly like `comparison` above
    // and for the same reason: a viewer who may not see a row cannot be scored
    // from it. Before the manager submits there is no submitted manager row to
    // find, so this reports `pct: null` rather than a running total — which
    // also means a subject polling their own appraisal mid-cycle cannot watch
    // their score assemble.
    const score = scoreAppraisal(sections, feedback, { kind: 'manager' });

    res.json({
      success: true,
      data: {
        appraisal: safeAppraisal, feedback, sections, access,
        approvedPeerCount, peerResponseCount, comparison, score,
      },
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/appraisals/:id/subject-answers — the employee's own self-answers,
 * for the person writing their manager assessment (Phase 5 §9.3).
 *
 * Two gates, both load-bearing:
 *
 *  - WHO: the assigned reviewer (relation 'manager') or an HR viewer whose
 *    scope covers this record. Not peers — a peer reading the subject's
 *    self-assessment is not a peer review, it is an audience. Not the subject
 *    either; they wrote it.
 *  - WHEN: only once the self row is 'submitted'. While it is pending this
 *    answers `selfSubmitted: false` and NO answers, so the reviewer's form can
 *    say "not yet submitted" rather than rendering an empty comparison that
 *    reads as though the employee answered nothing and was judged for it.
 *
 * Sections are filtered to the employee's own snapshot department and the
 * `self` kind, so a reviewer sees exactly the questions the employee was
 * actually asked — not the manager form's version of them.
 */
exports.subjectAnswers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id })
      .populate('cycle', 'name template')
      .lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (access.relation !== 'manager' && access.relation !== 'hr') {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const self = await AppraisalFeedback.findOne({
      tenant: req.tenant._id,
      appraisal: appraisal._id,
      kind: 'self',
    }).lean();

    if (!self || self.status !== 'submitted') {
      // Deliberately not a 404: the row exists, the employee simply has not
      // finished. Telling the reviewer which of those it is IS the feature.
      return res.json({
        success: true,
        data: { selfSubmitted: false, submittedAt: null, sections: [], answers: [] },
      });
    }

    const template = appraisal.cycle?.template
      ? await AppraisalTemplate.findOne({ _id: appraisal.cycle.template, tenant: req.tenant._id }).lean()
      : null;
    if (!template) {
      const err = new Error('The appraisal template for this appraisal could not be found.');
      err.status = 500;
      err.expose = true;
      throw err;
    }

    res.json({
      success: true,
      data: {
        selfSubmitted: true,
        submittedAt: self.submittedAt || null,
        sections: filterSections(template.sections, {
          kind: 'self',
          departmentId: appraisal.department ?? null,
        }),
        // Projected like every other feedback read, so a self row that somehow
        // carries a `comment` (normaliseAnswers strips them, but rows written
        // before this phase are not re-validated) cannot surface here as
        // reviewer commentary.
        answers: projectFeedbackForViewer(self, access).answers || [],
      },
    });
  } catch (err) { next(err); }
};

exports.saveSummary = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canSummarise) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    if (appraisal.state === 'collecting') {
      assertTransition('collecting', 'summarising');
      appraisal.state = 'summarising';
    }
    if (typeof req.body.summary === 'string') appraisal.summary = req.body.summary;
    if (req.body.finalRating != null) appraisal.finalRating = Number(req.body.finalRating);

    // Commitments are drafted alongside the summary and autosaved with it, so
    // the manager is not composing them for the first time in the release
    // dialog. `commitments: null` means the key was absent — leave what is
    // stored alone. An explicit `[]` clears them, and release will then refuse.
    const { commitments, errors } = normaliseCommitments(req.body.commitments);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }
    if (commitments !== null) appraisal.commitments = commitments;

    await appraisal.save();

    // Projected on principle, not because this path currently needs it: only
    // hr/manager (both canSeeReviewerNames: true) can reach here today, but
    // that is a fact about the current permission table, not a guarantee —
    // every handler that returns an appraisal document goes through
    // projectAppraisalForViewer so none of them silently depend on it.
    res.json({ success: true, data: projectAppraisalForViewer(appraisal, access) });
  } catch (err) { next(err); }
};

exports.releaseAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canRelease) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    if (!appraisal.summary || !String(appraisal.summary).trim()) {
      return res.status(400).json({ success: false, message: 'Write a summary before releasing' });
    }

    // At least one agreed action, or there is no release.
    //
    // Checked before the peer gate below because the two failures are
    // different in kind: this one says the manager's own work is unfinished,
    // whereas the peer gate is a warning about the input they had to work
    // with and can be confirmed through. Reporting the confirmable warning
    // first would invite the manager to dismiss it and then be blocked anyway.
    const { commitments, errors } = normaliseCommitments(req.body.commitments);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }
    // Fall back to whatever saveSummary already stored when release does not
    // resend them, so a manager who drafted actions earlier is not asked again.
    const agreed = commitments !== null ? commitments : (appraisal.commitments || []);
    if (agreed.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'NO_COMMITMENTS_AGREED',
        message:
          'Agree at least one action for the next period before releasing. An appraisal that ends in a rating alone changes nothing.',
      });
    }
    appraisal.commitments = agreed;

    // A summary built on one peer response looks identical to one built on
    // four. The manager confirms explicitly; the employee is told the count
    // separately in getAppraisal, because a warning the manager clicks through
    // protects nobody but the manager.
    const approvedPeerCount = countApprovedPeers(appraisal);
    const submittedPeerCount = await AppraisalFeedback.countDocuments({
      tenant: req.tenant._id,
      appraisal: appraisal._id,
      kind: 'peer',
      status: 'submitted',
    });
    const gate = peerReleaseGate({
      approvedPeerCount,
      submittedPeerCount,
      confirmed: req.body.confirmLowPeerCount === true,
    });
    if (gate.blocked) {
      return res.status(400).json({
        success: false,
        code: gate.code,
        approvedPeerCount: gate.approvedPeerCount,
        submittedPeerCount: gate.submittedPeerCount,
        threshold: gate.threshold,
        message: `This summary rests on ${submittedPeerCount} peer ${
          submittedPeerCount === 1 ? 'response' : 'responses'
        }. Confirm to release anyway.`,
      });
    }

    assertTransition(appraisal.state, 'released');
    appraisal.state = 'released';
    appraisal.releasedAt = new Date();
    appraisal.releasedBy = req.user._id;
    await appraisal.save();

    // See saveSummary: projected consistently rather than relying on the
    // fact that only hr/manager can currently reach this success path.
    res.json({ success: true, data: projectAppraisalForViewer(appraisal, access) });
  } catch (err) { next(err); }
};

exports.acknowledgeAppraisal = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canAcknowledge) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    assertTransition(appraisal.state, 'acknowledged');
    appraisal.state = 'acknowledged';
    appraisal.acknowledgedAt = new Date();
    if (typeof req.body.employeeResponse === 'string') {
      appraisal.employeeResponse = req.body.employeeResponse;
    }
    await appraisal.save();

    // Critical: access.canAcknowledge is true only for the subject relation,
    // which always has canSeeReviewerNames: false. Returning the raw document
    // here would hand the employee reviewerIds/peerNominations —
    // inert in Phase 1 (self+manager only) but a live reviewer-identity leak
    // as soon as Phase 2 populates real peer reviewers into reviewerIds.
    res.json({ success: true, data: projectAppraisalForViewer(appraisal, access) });
  } catch (err) { next(err); }
};

/**
 * Everyone in the tenant who may review this appraisal: active tenant users
 * other than the subject (who writes the self-assessment) and the manager
 * (who writes the manager assessment — a second row would double-count them).
 */
async function loadEligiblePeers(req, appraisal) {
  return User.find({
    tenant: req.tenant._id,
    // TENANT_ROLES straight from appraisal.helpers.js: exactly one definition
    // of "a person in this tenant", shared with cycle launch.
    role: { $in: TENANT_ROLES },
    status: 'active',
    _id: { $nin: [appraisal.employee, appraisal.manager] },
  })
    .select('firstName lastName email employeeProfile.work.jobTitle')
    .sort({ firstName: 1, lastName: 1 })
    .lean();
}

exports.getNomination = async (req, res, next) => {
  try {
    // Deliberately unpopulated: past 'nominating' this endpoint returns
    // exactly {state, approvedCount} (see nominationViewForSubject), so
    // resolving every nominee's name up front did a join whose result was
    // then discarded on every call but the one state that displays names.
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id }).lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    // Anyone with a stake in nomination may read this screen. Note this is NOT
    // access.canRead — that stays false for the subject until release, and this
    // payload is an allow-list built by nominationViewForSubject, never the
    // appraisal document.
    //
    // Deviation from the literal brief: `access.canNominate` is gated to the
    // 'nominating' state (see resolveAppraisalAccess), so checking only that
    // flag would 403 the subject the moment their nomination is submitted —
    // exactly when they still need this screen to read {state, approvedCount}.
    // The subject relation is admitted at every state instead; that does not
    // widen what is returned, because nominationViewForSubject itself
    // collapses to the bare count past 'nominating' regardless of who asks.
    if (
      access.relation !== 'subject' &&
      !access.canNominate &&
      !access.canApprovePeers &&
      !access.canBackfillPeers
    ) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: req.tenant._id }).lean();
    if (!cycle) {
      const err = new Error('The appraisal cycle for this appraisal could not be found.');
      err.status = 500; err.expose = true; throw err;
    }
    const eligible = await loadEligiblePeers(req, appraisal);

    // 'nominating' is the only state whose payload carries names (myProposals),
    // so it is the only one that pays for the lookup. Falls back to the
    // unpopulated document if the appraisal vanished between the two reads —
    // nominationViewForSubject handles bare ids, so a rare race degrades to
    // ids in the picker rather than a 500.
    const withNames = appraisal.state === 'nominating'
      ? (await Appraisal.findOne({ _id: appraisal._id, tenant: req.tenant._id })
          .populate('peerNominations.user', 'firstName lastName email employeeProfile.work.jobTitle')
          .lean()) || appraisal
      : appraisal;

    res.json({ success: true, data: nominationViewForSubject(withNames, cycle, eligible.length) });
  } catch (err) { next(err); }
};

exports.eligiblePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id }).lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canNominate && !access.canApprovePeers && !access.canBackfillPeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    res.json({ success: true, data: await loadEligiblePeers(req, appraisal) });
  } catch (err) { next(err); }
};

exports.nominatePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canNominate) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: req.tenant._id }).lean();
    if (!cycle) {
      const err = new Error('The appraisal cycle for this appraisal could not be found.');
      err.status = 500; err.expose = true; throw err;
    }
    const eligible = await loadEligiblePeers(req, appraisal);

    // A nomination can be SAVED without being submitted. Until this existed
    // the call was one-shot — canNominate is gated to 'nominating' and the
    // same call transitioned out of it — so an employee who clicked once with
    // a half-built list was locked out of their own nomination and needed HR
    // to unblock them. Only an explicit false (including the string a
    // non-JSON client posts) means draft; absent/true/"true" submits, so a
    // client that never learned about drafts behaves exactly as before.
    const isDraft = req.body.submit === false || req.body.submit === 'false';

    const result = validateNominations(req.body.userIds, {
      subjectId: appraisal.employee,
      managerId: appraisal.manager,
      eligibleIds: eligible.map((u) => u._id),
      // A draft is allowed to be short of the minimum — being incomplete is
      // what makes it a draft, and enforcing the floor here would defeat the
      // point. The maximum still applies either way: it caps the form rather
      // than describing completeness, and letting a draft exceed it would
      // only move the same rejection to submit time.
      min: isDraft ? 0 : effectiveNominationMin(cycle.peerCountMin, eligible.length),
      max: cycle.peerCountMax,
    });
    // Rejected whole: a half-applied nomination list is worse than none.
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.errors.join(' ') });
    }

    // Replace every 'proposed' entry, not just the caller's own: in this state
    // nothing can yet be approved or rejected, so nothing decided is lost, and
    // HR nominating for a silent employee produces one coherent list. With
    // drafts this is now live rather than theoretical — re-saving a draft is
    // the ordinary path through here, and appending would duplicate names.
    appraisal.peerNominations = result.userIds.map((user) => ({
      user,
      proposedBy: req.user._id,
      status: 'proposed',
    }));
    if (!isDraft) {
      assertTransition(appraisal.state, 'pending_peer_approval');
      appraisal.state = 'pending_peer_approval';
    }
    await appraisal.save();

    res.json({
      success: true,
      data: { state: appraisal.state, nominated: result.userIds.length, draft: isDraft },
    });
  } catch (err) { next(err); }
};

/**
 * Apply nomination decisions and materialise feedback rows for anyone newly
 * approved. Shared by approve-peers and backfill because they are the same
 * operation reached from two states — duplicating it would let the two drift,
 * and the anonymity-relevant part (who joins reviewerIds) must have one home.
 *
 * `session` must be enrolled in the same transaction the caller uses for its
 * own `appraisal.save()` — insertMany here durably commits new
 * AppraisalFeedback rows, and if the caller's subsequent save of
 * reviewerIds/peerNominations failed outside a shared transaction, a retry
 * would recompute those same peers as "new" (planPeerRowCreation only skips
 * reviewers already reflected in the saved appraisal) and collide with the
 * unique(appraisal, reviewer) index. See launchCycle in
 * appraisalCycle.controller.js for the precedent this follows.
 */
async function applyPeerDecisions(req, appraisalId, decisions, session) {
  // Re-read inside the transaction, enrolled in its session, rather than
  // mutating a document loaded outside it. withTransaction re-runs this whole
  // callback on a TransientTransactionError, and a document mutated by an
  // aborted attempt keeps those mutations in memory — so a retry would see the
  // new peers already in reviewerIds, conclude planPeerRowCreation had nothing
  // to do, skip insertMany entirely, and then commit an appraisal listing peers
  // who have no feedback row to answer. Reading fresh each attempt makes every
  // attempt idempotent against the state that is actually persisted.
  const appraisal = await Appraisal.findOne({
    _id: appraisalId,
    tenant: req.tenant._id,
  }).session(session);
  if (!appraisal) {
    const err = new Error('Appraisal not found');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  appraisal.peerNominations = applyNominationDecisions(
    appraisal.peerNominations, decisions, req.user._id
  );
  const newPeers = planPeerRowCreation(appraisal.peerNominations, appraisal.reviewerIds);

  if (newPeers.length) {
    await AppraisalFeedback.insertMany(
      newPeers.map((reviewer) => ({
        tenant: req.tenant._id,
        appraisal: appraisal._id,
        cycle: appraisal.cycle,
        reviewer,
        kind: 'peer',
      })),
      { session }
    );
    // A peer joins the array the access resolver trusts ONLY here, after
    // approval — never at nomination time.
    appraisal.reviewerIds.push(...newPeers);
  }
  return { appraisal, createdCount: newPeers.length };
}

exports.approvePeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canApprovePeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    // Names the approver adds themselves must still be eligible — the picker
    // is client-side and the server does not trust it.
    const added = (req.body.add || []).map(String);
    if (added.length) {
      const eligible = await loadEligiblePeers(req, appraisal);
      const ok = new Set(eligible.map((u) => String(u._id)));
      if (added.some((u) => !ok.has(u))) {
        return res.status(400).json({
          success: false,
          message: 'One or more of the people added are not eligible to review this appraisal.',
        });
      }
    }

    // The insertMany inside applyPeerDecisions and this save() are one
    // logical operation — either both land or neither does. Without a shared
    // transaction, a save() failure after insertMany durably committed would
    // leave the approved peers' feedback rows persisted but reviewerIds/
    // peerNominations unchanged, so a retry would recompute them as "new" and
    // collide with the unique(appraisal, reviewer) index.
    let createdCount = 0;
    let finalState;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Assigned inside the callback so the response reports the attempt
        // that actually committed, not one withTransaction later discarded.
        const applied = await applyPeerDecisions(req, appraisal._id, {
          approve: req.body.approve, reject: req.body.reject, add: req.body.add,
        }, session);
        assertTransition(applied.appraisal.state, 'collecting');
        applied.appraisal.state = 'collecting';
        await applied.appraisal.save({ session });
        createdCount = applied.createdCount;
        finalState = applied.appraisal.state;
      });
    } finally {
      session.endSession();
    }

    res.json({ success: true, data: { state: finalState, peersAdded: createdCount } });
  } catch (err) { next(err); }
};

exports.backfillPeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canBackfillPeers) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const added = (req.body.add || []).map(String);
    if (!added.length) {
      return res.status(400).json({ success: false, message: 'Choose at least one replacement peer.' });
    }
    const eligible = await loadEligiblePeers(req, appraisal);
    const ok = new Set(eligible.map((u) => String(u._id)));
    if (added.some((u) => !ok.has(u))) {
      return res.status(400).json({
        success: false,
        message: 'One or more of the people added are not eligible to review this appraisal.',
      });
    }

    // Same atomicity requirement as approvePeers: the insertMany and the save
    // must land together or not at all.
    let createdCount = 0;
    let finalState;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const applied = await applyPeerDecisions(req, appraisal._id, { add: added }, session);
        await applied.appraisal.save({ session }); // state unchanged: backfill happens during collecting
        createdCount = applied.createdCount;
        finalState = applied.appraisal.state;
      });
    } finally {
      session.endSession();
    }
    res.json({ success: true, data: { state: finalState, peersAdded: createdCount } });
  } catch (err) { next(err); }
};

exports.skipPeers = async (req, res, next) => {
  try {
    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    // Deliberately HR-only: skipping peers is the unblock-a-stall power, not a
    // way for a manager to opt out of the 360 they were asked to run.
    if (access.relation !== 'hr' || !(access.canNominate || access.canApprovePeers)) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    assertTransition(appraisal.state, 'collecting');
    appraisal.state = 'collecting';
    await appraisal.save();
    res.json({ success: true, data: { state: appraisal.state } });
  } catch (err) { next(err); }
};

/**
 * Remind someone who is holding an appraisal up.
 *
 * Gated on canManageCycle — HR only in Phase 3. The manager is arguably the
 * more natural chaser and this gate is one condition away from admitting them,
 * but that needs its own UI on the team page and is deliberately out of scope.
 *
 * PRIVACY: the nudge row goes to its OWN collection (see models/
 * AppraisalNudge.js). Nothing here writes a reviewer id back onto the
 * Appraisal document, which is what keeps the subject's payload structurally
 * free of it — REVIEWER_IDENTITY_FIELDS is a deny-list and would otherwise
 * have to be extended for every new identity-bearing field.
 */
exports.nudge = async (req, res, next) => {
  try {
    // A malformed id must be a 400, not the 500 a CastError would become —
    // server.js's handler translates ValidationError only and deliberately
    // leaves CastError alone. Same guard as cycleProgress/cycleRoster.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid appraisal id' });
    }
    // Tenant scoping in this codebase is req.tenant._id; req.tenantId does not
    // exist. A missing tenant must NOT reach a query filter — mongoose strips
    // `undefined` out, so {tenant: undefined} silently becomes {} and matches
    // every appraisal in the database.
    if (!req.tenant?._id) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }
    const tenantId = new mongoose.Types.ObjectId(req.tenant._id);

    const appraisal = await Appraisal.findOne({ _id: req.params.id, tenant: tenantId }).lean();
    if (!appraisal) return res.status(404).json({ success: false, message: 'Appraisal not found' });

    const access = await accessFor(req, appraisal);
    if (!access.canManageCycle) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }

    const { target, reason, channel = 'app', force = false } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(target)) {
      return res.status(400).json({ success: false, message: 'Invalid target id' });
    }
    if (!NUDGE_CHANNELS.includes(channel)) {
      // Refused rather than downgraded to 'app': HR clicking "remind by email"
      // and getting a silent in-app-only reminder is the same failure as a
      // silently unsent email.
      return res.status(400).json({ success: false, message: 'Unsupported nudge channel' });
    }

    const rows = await AppraisalFeedback.find({
      tenant: tenantId, appraisal: appraisal._id,
    }).select('appraisal reviewer kind status').lean();

    // The target must actually owe something. This is what stops the endpoint
    // being used to probe who is on an appraisal: an arbitrary user id gets
    // the same 400 as a real reviewer who simply has nothing outstanding.
    //
    // A cancelled appraisal can still carry `pending` feedback rows that
    // closeCycle never expired; outstandingActionsFor returns [] for it, so
    // every target on one is refused here. That is intended — chasing somebody
    // for work on a cancelled appraisal is precisely the reminder nobody
    // should get.
    const outstanding = outstandingActionsFor(appraisal, rows);
    const match = outstanding.find(
      (o) => String(o.target) === String(target) && o.reason === reason
    );
    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'That person has nothing outstanding on this appraisal.',
      });
    }

    // Somebody removed from the tenant keeps their pending feedback rows — the
    // rows are not deleted, so outstandingActionsFor still reports them — but
    // they cannot sign in to act on one. The roster already stops naming them,
    // so this is only reachable by a stale page or a hand-made request; it is
    // refused here anyway rather than left to send a reminder to a former
    // employee's inbox.
    const deleted = new Set((await deletedEmployeeIdsFor(req)).map(String));
    if (deleted.has(String(target))) {
      return res.status(400).json({
        success: false,
        message: 'That person no longer works here — reassign the review instead.',
      });
    }

    if (!force) {
      // Newest row for this exact (appraisal, target, reason), compared in JS.
      // The compound index on the model is ordered to serve this directly.
      const recent = await AppraisalNudge.findOne({
        tenant: tenantId, appraisal: appraisal._id, target, reason,
      }).sort({ sentAt: -1 }).lean();
      const windowMs = NUDGE_MIN_INTERVAL_HOURS * 3600 * 1000;
      const lastAt = recent?.sentAt ? new Date(recent.sentAt).getTime() : null;
      if (lastAt != null && Date.now() - lastAt < windowMs) {
        return res.status(429).json({
          success: false,
          code: 'NUDGE_TOO_SOON',
          message: `This person was already reminded in the last ${NUDGE_MIN_INTERVAL_HOURS} hours.`,
          retryAfter: new Date(lastAt + windowMs),
        });
      }
    }

    let emailSent = false;
    let emailError = null;
    if (channel === 'email') {
      const person = await User.findOne({ _id: target, tenant: tenantId })
        .select('firstName lastName email').lean();
      const cycle = await AppraisalCycle.findOne({ _id: appraisal.cycle, tenant: tenantId })
        .select('name feedbackDeadline').lean();
      try {
        // sendEmail never throws — it catches internally and returns
        // {success:false, error} — so "no exception" is NOT delivery. Both
        // shapes are handled: a thrown transport error and a returned failure.
        const result = await emailService.sendAppraisalNudgeEmail({
          to: person?.email,
          name: person?.firstName,
          cycleName: cycle?.name,
          reason,
          deadline: cycle?.feedbackDeadline,
          link: `${process.env.ADMIN_URL || ''}/appraisals`,
        });
        if (result && result.success === false) {
          emailError = result.error || 'Email could not be sent';
        } else {
          emailSent = true;
        }
      } catch (e) {
        emailError = e?.message || 'Email could not be sent';
      }
    }

    const created = await AppraisalNudge.create({
      tenant: tenantId,
      appraisal: appraisal._id,
      cycle: appraisal.cycle,
      target,
      reason,
      // A requested-but-failed email is stored as 'app': the in-app reminder
      // did land, and calling it 'email' would tell HR to stop chasing.
      channel: emailSent ? 'email' : 'app',
      sentBy: req.user._id,
      sentAt: new Date(),
      ...(emailError ? { emailError } : {}),
    });

    res.status(201).json({
      success: true,
      data: {
        _id: created._id,
        sentAt: created.sentAt,
        channel: created.channel,
        reason,
        emailSent,
        emailError,
      },
    });
  } catch (err) { next(err); }
};

exports.NUDGE_MIN_INTERVAL_HOURS = NUDGE_MIN_INTERVAL_HOURS;

// Exported solely so the pure, DB-free projection logic above can be unit
// tested (see __tests__/appraisal.helpers.test.js). Not part of the route
// surface — routes only consume the named handlers above.
exports._internal = { sanitizeOwnAppraisalRow, projectAppraisalForViewer, omit, loadEligiblePeers };
