// server/routes/appraisal.routes.js
const express = require('express');
const {
  protect,
  attachTenant,
  requireOwnTenant,
  tenantAdminOrSuperAdmin,
  authorize,
} = require('../middleware/auth.middleware');

// Phase 5 §9.5. Standing feedback is the owner's read and nobody else's — not
// HR's, not the department admin's. `authorize` rather than
// tenantAdminOrSuperAdmin because that gate includes tenant_admin, which is
// precisely who must not see this.
const ownerOnly = authorize('tenant_owner', 'super_admin');

const cycles = require('../controllers/appraisalCycle.controller');
const appraisals = require('../controllers/appraisal.controller');
const feedback = require('../controllers/appraisalFeedback.controller');
const templates = require('../controllers/appraisalTemplate.controller');

const cycleRouter = express.Router();
const appraisalRouter = express.Router();
const feedbackRouter = express.Router();
const templateRouter = express.Router();

for (const r of [cycleRouter, appraisalRouter, feedbackRouter, templateRouter]) {
  r.use(protect);
  r.use(attachTenant);
  r.use(requireOwnTenant);
}

// ── HR: cycles ──────────────────────────────────────────────────────────────
cycleRouter.use(tenantAdminOrSuperAdmin);
cycleRouter.route('/').get(cycles.listCycles).post(cycles.createCycle);
cycleRouter.route('/:id').get(cycles.getCycle);
cycleRouter.post('/:id/launch', cycles.launchCycle);
cycleRouter.post('/:id/close', cycles.closeCycle);
cycleRouter.get('/:id/progress', cycles.cycleProgress);
// MUST stay on the admin-gated cycleRouter. The roster names peer reviewers
// (outstandingActionsFor returns pending peers by id), which the subject of an
// appraisal must never see. Moving it to appraisalRouter — which is
// deliberately not admin-gated — would silently expose it.
cycleRouter.get('/:id/roster', cycles.cycleRoster);
// Same reasoning as the roster: HR-only by mount point. The report names
// nobody — it is counts and per-question means — but it aggregates every
// reviewer's answers across the whole cycle, which is org-wide performance
// data and not the subject's to read. cycleRouter's tenantAdminOrSuperAdmin
// gate IS the boundary; do not move this to the ungated appraisalRouter.
cycleRouter.get('/:id/report', cycles.cycleReport);

// ── HR: form builder ────────────────────────────────────────────────────────
templateRouter.use(tenantAdminOrSuperAdmin);
templateRouter.route('/').get(templates.listTemplates).post(templates.createTemplate);
// Drafting aids. Same admin gate as the write routes above — a generated form
// is a form. None of these touch the database: they return a draft the editor
// previews and HR accepts, so versioning is unaffected. Declared before
// '/:id' so the literal path can never be read as an id.
templateRouter.post('/ai/template', templates.aiGenerateTemplate);
templateRouter.post('/ai/section', templates.aiGenerateSection);
templateRouter.post('/ai/question', templates.aiAssistQuestion);
templateRouter.route('/:id').get(templates.getTemplate).put(templates.updateTemplate);
templateRouter.get('/:id/versions', templates.listVersions);
templateRouter.post('/:id/archive', templates.archiveTemplate);

// ── Everyone: their own appraisals and their reports' ───────────────────────
// Deliberately NOT gated to admins: tenant_staff must reach their own record.
appraisalRouter.get('/my', appraisals.myAppraisals);
appraisalRouter.get('/my/reviews', appraisals.myReviewRequests);
appraisalRouter.get('/team', appraisals.teamAppraisals);
appraisalRouter.get('/:id', appraisals.getAppraisal);
// Phase 5 §9.3: the employee's self-answers, for whoever is writing their
// manager assessment. The handler gates on relation manager/hr and on the self
// row actually being submitted; there is no role gate here because the
// assigned reviewer is frequently tenant_staff.
appraisalRouter.get('/:id/subject-answers', appraisals.subjectAnswers);
appraisalRouter.post('/:id/summary', appraisals.saveSummary);
appraisalRouter.post('/:id/release', appraisals.releaseAppraisal);
appraisalRouter.post('/:id/acknowledge', appraisals.acknowledgeAppraisal);

// ── Phase 2: peer nomination ─────────────────────────────────────────────
appraisalRouter.get('/:id/nomination', appraisals.getNomination);
appraisalRouter.get('/:id/eligible-peers', appraisals.eligiblePeers);
appraisalRouter.post('/:id/nominate', appraisals.nominatePeers);
appraisalRouter.post('/:id/approve-peers', appraisals.approvePeers);
appraisalRouter.post('/:id/peers', appraisals.backfillPeers);
appraisalRouter.post('/:id/skip-peers', appraisals.skipPeers);

// ── Phase 3: nudges ─────────────────────────────────────────────────────────
// Keyed on an APPRAISAL id, so it belongs on this router rather than the
// cycle one — but this router is deliberately not admin-gated, so the route
// carries tenantAdminOrSuperAdmin itself. The handler independently requires
// access.canManageCycle; both must hold. Belt and braces on purpose: the
// request body names a person, and a 400-vs-201 split would otherwise let a
// non-HR caller probe who is on someone else's 360.
appraisalRouter.post('/:id/nudge', tenantAdminOrSuperAdmin, appraisals.nudge);

// ── Reviewers: their own feedback row only ──────────────────────────────────
// Declared BEFORE '/:id' so the literal path can never be read as a feedback
// id. Gated at the route AND re-checked inside listStandingFeedback — belt and
// braces, because "HR-only by mount point" is the pattern that leaked in this
// module before.
feedbackRouter.get('/standing', ownerOnly, feedback.listStandingFeedback);
feedbackRouter.get('/:id', feedback.getFeedback);
// The author's own optional step on their self-form. Ownership, not role:
// loadOwnFeedback matches on reviewer === req.user._id, so an id belonging to
// anyone else is a 404.
feedbackRouter.get('/:id/standing', feedback.getStandingForm);
feedbackRouter.post('/:id/standing', feedback.saveStandingFeedback);
feedbackRouter.patch('/:id', feedback.saveDraft);
feedbackRouter.post('/:id/submit', feedback.submitFeedback);
feedbackRouter.post('/:id/decline', feedback.declineFeedback);

module.exports = { cycleRouter, appraisalRouter, feedbackRouter, templateRouter };
