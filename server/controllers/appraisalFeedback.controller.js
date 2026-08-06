// server/controllers/appraisalFeedback.controller.js — reviewer-facing
const AppraisalFeedback = require('../models/AppraisalFeedback');
const Appraisal = require('../models/Appraisal');
const AppraisalCycle = require('../models/AppraisalCycle');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const {
  filterSectionsForKind,
  getAskedQuestionIds,
  partitionAnswersByAskedQuestions,
} = require('../services/appraisal.helpers');

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
        // Drives the disclosure banner. Phase 1 has no peer feedback, but the
        // contract is in place so Phase 2 does not change the response shape.
        visibility:
          fb.kind === 'peer'
            ? { namedTo: ['manager', 'hr'], anonymousTo: ['employee'] }
            : { namedTo: ['manager', 'hr', 'employee'], anonymousTo: [] },
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
      fb.answers = allowed;
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
      fb.answers = allowed;
    }
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
