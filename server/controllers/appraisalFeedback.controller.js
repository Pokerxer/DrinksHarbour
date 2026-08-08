// server/controllers/appraisalFeedback.controller.js — reviewer-facing
const AppraisalFeedback = require('../models/AppraisalFeedback');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const {
  filterSectionsForKind,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
  normaliseAnswers,
  findUnansweredRequired,
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
 */
async function loadAskedSections(fb) {
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
  const sections = filterSectionsForKind(template.sections, fb.kind);
  return { cycle, template, sections };
}

exports.getFeedback = async (req, res, next) => {
  try {
    const fb = await loadOwnFeedback(req);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    const appraisal = await Appraisal.findOne({ _id: fb.appraisal, tenant: fb.tenant })
      .populate('employee', 'firstName lastName email')
      .lean();
    const { cycle, sections } = await loadAskedSections(fb);

    res.json({
      success: true,
      data: {
        feedback: fb,
        kind: fb.kind,
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
