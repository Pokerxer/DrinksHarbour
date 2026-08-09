// server/controllers/appraisalFeedback.controller.js — reviewer-facing
const AppraisalFeedback = require('../models/AppraisalFeedback');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const PeerStandingFeedback = require('../models/PeerStandingFeedback');
const User = require('../models/User');
const {
  filterSections,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
  normaliseAnswers,
  findUnansweredRequired,
  normaliseStandingEntries,
  STANDING_VALUES,
  TENANT_ROLES,
} = require('../services/appraisal.helpers');

/**
 * What this employee last agreed to do, from their most recent completed
 * appraisal — the thing that turns a cycle into a sequence rather than a
 * series of unrelated snapshots.
 *
 * Shown only on self and manager forms. A peer has no business reading what
 * a colleague privately committed to with their manager, and peers are the
 * one reviewer kind whose form this must never appear on.
 *
 * Excludes the appraisal currently being reviewed by cycle, not by id: a
 * re-run or a second appraisal in the same cycle would otherwise quote this
 * period's own commitments back as though they were last period's.
 */
async function loadPriorCommitments(fb, appraisal) {
  if (fb.kind !== 'self' && fb.kind !== 'manager') return null;
  if (!appraisal?.employee) return null;

  const employeeId = appraisal.employee._id || appraisal.employee;
  const prior = await Appraisal.findOne({
    tenant: fb.tenant,
    employee: employeeId,
    cycle: { $ne: fb.cycle },
    state: { $in: ['released', 'acknowledged'] },
    'commitments.0': { $exists: true },
  })
    // Most recently released wins. `releasedAt` rather than createdAt: cycles
    // are not necessarily created in the order they complete.
    .sort({ releasedAt: -1 })
    .select('commitments releasedAt cycle')
    .populate('cycle', 'name')
    .lean();

  if (!prior) return null;
  return {
    cycleName: prior.cycle?.name || null,
    releasedAt: prior.releasedAt || null,
    commitments: prior.commitments || [],
  };
}

/**
 * Load a feedback row the caller owns. A reviewer may only ever touch their own
 * row — this is an ownership check, not a role check, so it holds for HR too.
 */
async function loadOwnFeedback(req) {
  return AppraisalFeedback.findOne({
    _id: req.params.id,
    tenant: req.tenant._id,
    reviewer: req.user._id,
  });
}

/**
 * Load the cycle + template behind a feedback row and filter the template's
 * questions down to the ones this reviewer's `kind` is actually asked. Used
 * by every read/write path so "which questions can this reviewer answer" has
 * exactly one definition — getFeedback used to inline this filter, and
 * saveDraft/submitFeedback need the same set to validate incoming answers.
 *
 * A feedback row's `cycle` and `cycle.template` always point at real
 * documents in normal operation. If either lookup comes back empty, the row
 * is in a broken state, not an empty questionnaire — throw loudly instead of
 * letting the caller silently treat "nothing to answer" as success.
 *
 * The department and roles come off the APPRAISAL's snapshot (Phase 5 §9.1),
 * never off the employee's current profile: a reviewer part-way through a form
 * must not have questions appear or vanish because the subject transferred or
 * changed job this morning. Callers that already hold the appraisal pass it in
 * rather than paying for the read twice.
 */
async function loadAskedSections(fb, knownAppraisal) {
  const appraisal = knownAppraisal
    // Both snapshots or neither. Projecting one of the two scoping fields is
    // how a role-scoped section disappears from a form with no error anywhere.
    || await Appraisal.findOne({ _id: fb.appraisal, tenant: fb.tenant }).select('department roles').lean();
  const cycle = await AppraisalCycle.findOne({ _id: fb.cycle, tenant: fb.tenant }).lean();
  if (!cycle) {
    const err = new Error('The appraisal cycle for this feedback could not be found.');
    err.status = 500;
    err.expose = true;
    throw err;
  }
  const template = await AppraisalTemplate.findOne({ _id: cycle.template, tenant: fb.tenant }).lean();
  if (!template) {
    const err = new Error('The appraisal template for this feedback could not be found.');
    err.status = 500;
    err.expose = true;
    throw err;
  }
  const sections = filterSections(template.sections, {
    kind: fb.kind,
    departmentId: appraisal?.department ?? null,
    roleIds: appraisal?.roles || [],
  });
  return { cycle, template, sections, appraisal };
}

exports.getFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    const appraisal = await Appraisal.findOne({ _id: fb.appraisal, tenant: fb.tenant })
      .populate('employee', 'firstName lastName email')
      .lean();
    const { cycle, sections } = await loadAskedSections(fb, appraisal);

    res.json({
      success: true,
      data: {
        feedback: fb,
        kind: fb.kind,
        // Named explicitly rather than left for the client to dig out of the
        // feedback row: the manager form needs it to fetch the subject's own
        // answers (Phase 5 §9.3), and a payload field a caller has to know is
        // hiding on a nested document is a field that eventually gets removed.
        appraisalId: fb.appraisal ? String(fb.appraisal) : null,
        subject: appraisal?.employee || null,
        cycleName: cycle.name || '',
        deadline: cycle.feedbackDeadline || null,
        sections,
        // What this person agreed to last time, so the review opens on it.
        priorCommitments: await loadPriorCommitments(fb, appraisal),
        // Drives the disclosure banner, which is how a reviewer calibrates how
        // candid to be — so it has to describe what actually happens.
        //
        // `withheldFrom` is a stronger claim than `anonymousTo` and replaces it
        // for peers: their feedback is not shown to the employee under a
        // stripped name, it is not shown to the employee at all. Saying merely
        // "anonymous" would understate the protection, and a peer who
        // believes the subject will read their words — name attached or not —
        // writes the vague, unfalsifiable thing that helps nobody.
        visibility:
          fb.kind === 'peer'
            ? { namedTo: ['manager', 'hr'], anonymousTo: [], withheldFrom: ['employee'] }
            : { namedTo: ['manager', 'hr', 'employee'], anonymousTo: [], withheldFrom: [] },
      },
    });
  } catch (err) { next(err); }
};

exports.saveDraft = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    // Non-pending rows are not editable. Distinguish the two reasons: a row is
    // 'expired' when closeCycle ended the cycle with feedback outstanding, which
    // is not the reviewer's doing and reads as a mistake if reported as
    // "already submitted".
    if (fb.status !== 'pending') {
      const reason =
        fb.status === 'submitted'
          ? 'This feedback is already submitted'
          : 'This feedback has expired and can no longer be edited';
      return res.status(400).json({ success: false, message: reason });
    }
    if (Array.isArray(req.body.answers)) {
      const { sections } = await loadAskedSections(fb);
      const askedIds = getAskedQuestionIds(sections);
      const { allowed, rejectedIds } = partitionAnswersByAskedQuestions(req.body.answers, askedIds);
      if (rejectedIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Answers were submitted for question id(s) not asked of this reviewer: ${rejectedIds.join(', ')}`,
        });
      }
      // Same abstention rules as submit — a draft must not be able to park a
      // not-observed flag on a self/manager row, or carry a rating alongside
      // one, and then have submit inherit it. Required-question completeness
      // is deliberately NOT checked: a draft is partial by definition.
      const { answers, errors } = normaliseAnswers(allowed, fb.kind);
      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: errors.join(' ') });
      }
      fb.answers = answers;
    }
    await fb.save();
    res.json({ success: true, data: fb });
  } catch (err) { next(err); }
};

exports.submitFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    // Only pending feedback may be submitted. Checking !== 'pending' rather
    // than === 'submitted' also blocks 'expired' rows, which closeCycle sets
    // when a cycle ends with feedback outstanding — otherwise a reviewer could
    // submit into a closed cycle, and could submit a draft they are no longer
    // permitted to save.
    if (fb.status !== 'pending') {
      const reason =
        fb.status === 'submitted'
          ? 'This feedback is already submitted'
          : 'This feedback has expired and can no longer be submitted';
      return res.status(400).json({ success: false, message: reason });
    }
    // Unlike saveDraft, submit ALWAYS resolves the template — a submission
    // with no `answers` key at all is an empty form, and the required-question
    // check below is what has to catch it. Reading req.body.answers as `[]`
    // rather than skipping the block is the difference between rejecting that
    // and silently accepting it.
    const { sections } = await loadAskedSections(fb);
    const askedIds = getAskedQuestionIds(sections);
    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    const { allowed, rejectedIds } = partitionAnswersByAskedQuestions(incoming, askedIds);
    if (rejectedIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Answers were submitted for question id(s) not asked of this reviewer: ${rejectedIds.join(', ')}`,
      });
    }

    const { answers, errors } = normaliseAnswers(allowed, fb.kind);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    // Enforced here rather than left to the client. `required` was previously
    // advisory — the form greyed out its own submit button and the server
    // accepted whatever arrived — so an empty submission from a stale tab or
    // a direct API call landed as a complete assessment. It matters more now
    // that peers have a legitimate way to abstain: "not observed" is only
    // meaningfully different from skipping if skipping is actually refused.
    const missing = findUnansweredRequired(answers, sections);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'REQUIRED_QUESTIONS_UNANSWERED',
        missing,
        message: `Answer every required question before submitting: ${missing.join(', ')}.`,
      });
    }

    fb.answers = answers;
    fb.status = 'submitted';
    fb.submittedAt = new Date();
    await fb.save();
    res.json({ success: true, data: fb });
  } catch (err) { next(err); }
};

exports.declineFeedback = async (req, res, next) => {
  try {
    // loadOwnFeedback is an ownership check, not a role check — a reviewer may
    // only ever touch their own row, HR included.
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    // Self and manager assessments are not optional. Only peer participation is.
    if (fb.kind !== 'peer') {
      return res.status(400).json({
        success: false,
        message: 'Only peer feedback can be declined.',
      });
    }
    if (fb.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message:
          fb.status === 'submitted'
            ? 'This feedback has already been submitted and can no longer be declined.'
            : `This feedback is ${fb.status} and can no longer be declined.`,
      });
    }

    fb.status = 'declined';
    fb.declinedAt = new Date();
    if (typeof req.body.reason === 'string' && req.body.reason.trim()) {
      fb.declineReason = req.body.reason.trim();
    }
    await fb.save();

    res.json({ success: true, data: { status: fb.status, declinedAt: fb.declinedAt } });
  } catch (err) { next(err); }
};

// ─── Phase 5 §9.5: standing feedback ────────────────────────────────────────
//
// "Who on my team is doing well, and who needs support", written by an
// employee about their own department as an OPTIONAL step on their self-form,
// and readable by the tenant owner alone.
//
// Three properties this code has to keep true, none of which the schema can
// enforce on its own:
//
//  1. It never joins an appraisal payload. There is no roster field, no report
//     field, no comparison row — the only read is listStandingFeedback below.
//  2. It is attributed. Peer feedback is anonymous because it is about the
//     person who will read it; this is about third parties and read by the
//     owner, and an unattributed report on a colleague is a rumour.
//  3. Only the AUTHOR writes their own report, resolved from their own self
//     feedback row (loadOwnFeedback is an ownership check), never from an id
//     in the body.

/** Roles that may read the whole tenant's standing feedback. Nobody else. */
const STANDING_READER_ROLES = ['tenant_owner', 'super_admin'];

/**
 * The colleagues this author may report on: active employees in the same
 * department, excluding the author.
 *
 * Drawn from the APPRAISAL's department snapshot, matching filterSections —
 * the candidate list an author saw when they opened the form must be the one
 * their submission is validated against, even if they transferred since.
 */
async function loadStandingCandidates(tenantId, appraisal, authorId) {
  const department = appraisal?.department;
  if (!department) return [];
  const rows = await User.find({
    tenant: tenantId,
    role: { $in: TENANT_ROLES },
    status: 'active',
    'employeeProfile.work.department': department,
    _id: { $ne: authorId },
  })
    .select('firstName lastName email employeeProfile.work.jobTitle')
    .lean();
  return rows;
}

/**
 * GET /api/appraisal-feedback/:id/standing — the author's own form.
 *
 * Keyed on their SELF feedback row: the step belongs to the self-assessment,
 * and loadOwnFeedback means an id belonging to anybody else is a 404 before
 * any of this runs.
 */
exports.getStandingForm = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    // Only on the self form. A manager or peer commenting on a third party
    // through this endpoint would be a different feature with different rules.
    if (fb.kind !== 'self') {
      return res.status(400).json({
        success: false,
        message: 'Standing feedback is part of your own self-assessment.',
      });
    }

    const appraisal = await Appraisal.findOne({ _id: fb.appraisal, tenant: fb.tenant })
      .select('department')
      .lean();
    const [candidates, existing] = await Promise.all([
      loadStandingCandidates(fb.tenant, appraisal, req.user._id),
      PeerStandingFeedback.findOne({
        tenant: fb.tenant, cycle: fb.cycle, author: req.user._id,
      }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        // Empty when the employee has no department: there is nobody to report
        // on, and the UI hides the step rather than showing an empty list.
        candidates,
        entries: existing?.entries || [],
        submittedAt: existing?.submittedAt || null,
        standingValues: STANDING_VALUES,
        // Said plainly on the form. An employee writing about a colleague is
        // entitled to know exactly who reads it and that their name is on it.
        visibility: { namedTo: ['owner'], withheldFrom: ['subject', 'manager', 'hr'] },
      },
    });
  } catch (err) { next(err); }
};

/**
 * POST /api/appraisal-feedback/:id/standing — save the author's report.
 *
 * Upserted on {author, cycle}, which is the unique index: re-submitting
 * REPLACES the whole list rather than appending, so removing a name in the UI
 * actually removes it.
 */
exports.saveStandingFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });
    if (fb.kind !== 'self') {
      return res.status(400).json({
        success: false,
        message: 'Standing feedback is part of your own self-assessment.',
      });
    }
    // Tied to the self form's own editability. Once the self-assessment is
    // submitted or expired the cycle has moved on, and a standing report
    // arriving afterwards would be commentary on a review already in progress.
    if (fb.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Your self-assessment is already submitted, so this can no longer be changed.',
      });
    }

    const appraisal = await Appraisal.findOne({ _id: fb.appraisal, tenant: fb.tenant })
      .select('department')
      .lean();
    const candidates = await loadStandingCandidates(fb.tenant, appraisal, req.user._id);
    const { entries, errors } = normaliseStandingEntries(req.body?.entries, {
      candidateIds: candidates.map((c) => c._id),
      authorId: req.user._id,
    });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' ') });
    }

    const saved = await PeerStandingFeedback.findOneAndUpdate(
      { author: req.user._id, cycle: fb.cycle },
      {
        $set: {
          tenant: fb.tenant,
          appraisal: fb.appraisal,
          // Snapshot, matching Appraisal.department: which team this was
          // written about is a fact about when it was written.
          department: appraisal?.department ?? null,
          entries,
          submittedAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: { entries: saved?.entries || entries } });
  } catch (err) { next(err); }
};

/**
 * GET /api/appraisal-feedback/standing?cycle= — the owner's read.
 *
 * Gated to tenant_owner + super_admin at the route AND re-checked here. Belt
 * and braces on purpose: this module has already shipped a fix for a leak
 * caused by a payload that was "HR-only by mount point", and a route file is
 * exactly the thing a later refactor moves a handler out of without noticing.
 */
exports.listStandingFeedback = async (req, res, next) => {
  try {
    if (!STANDING_READER_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Not permitted' });
    }
    if (!req.tenant?._id) {
      return res.status(403).json({ success: false, message: 'Tenant context required' });
    }
    const cycle = req.query?.cycle;
    if (!cycle) {
      return res.status(400).json({ success: false, message: 'A cycle is required.' });
    }

    const rows = await PeerStandingFeedback.find({ tenant: req.tenant._id, cycle })
      .populate('author', 'firstName lastName email')
      .populate('department', 'name')
      .populate('entries.subject', 'firstName lastName email')
      .sort({ createdAt: 1 })
      .lean();

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
