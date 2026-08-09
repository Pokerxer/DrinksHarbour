// server/controllers/appraisalTemplate.controller.js — HR-facing form builder
//
// Templates are copy-on-write versioned: `family` is stable, `version`
// increments, and exactly one row per family carries `isLatest`. A cycle pins
// a concrete version at launch, so editing a form never rewrites an appraisal
// an employee has already signed off on.
const mongoose = require('mongoose');
const AppraisalTemplate = require('../models/AppraisalTemplate');
const AppraisalCycle = require('../models/AppraisalCycle');
const Department = require('../models/Department');

/**
 * Structural rules a Mongoose schema cannot express. Everything else —
 * required labels, the askOf enum, scaleMax bounds — is left to schema
 * validation, which the global handler in server.js turns into a 400 carrying
 * `fields: [...]` for the form to highlight.
 */
function validateTemplateShape(sections) {
  const errors = [];
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push('A form needs at least one section.');
    return errors;
  }
  sections.forEach((s, i) => {
    if (!Array.isArray(s?.questions) || s.questions.length === 0) {
      errors.push(`Section ${i + 1} ("${s?.title || 'untitled'}") needs at least one question.`);
      return;
    }
    s.questions.forEach((q, j) => {
      errors.push(...validateOptionScores(q, `Section ${i + 1} question ${j + 1}`));
    });
  });
  return errors;
}

/**
 * `optionScores` pairs positionally with `options`: the rater picks a
 * described option and the score at the same index is what gets stored, out of
 * sight. Every rule here exists because breaking the pairing fails SILENTLY —
 * an index with no score maps to `undefined`, and the answer saves with no
 * rating at all rather than raising anything the author would see.
 *
 * A question with neither field is an ordinary rating question and is left
 * alone; only a question carrying scores is held to these rules.
 */
function validateOptionScores(q, where) {
  const scores = q?.optionScores;
  if (scores == null) return [];
  const errors = [];
  if (!Array.isArray(scores)) {
    errors.push(`${where}: option scores must be a list.`);
    return errors;
  }
  const options = Array.isArray(q?.options) ? q.options : [];
  if (options.length === 0) {
    errors.push(`${where}: has option scores but no options to attach them to.`);
    return errors;
  }
  if (options.length !== scores.length) {
    errors.push(
      `${where}: has ${options.length} option(s) but ${scores.length} score(s) — every option needs exactly one score.`
    );
    return errors;
  }
  // Defaults to 5 to match the schema, so a question that omits scaleMax is
  // held to the same ceiling the renderer and scoreAppraisal will assume.
  const max = typeof q.scaleMax === 'number' && Number.isFinite(q.scaleMax) ? q.scaleMax : 5;
  scores.forEach((n, k) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      errors.push(`${where}: option ${k + 1} has a non-numeric score.`);
    } else if (n < 0 || n > max) {
      errors.push(`${where}: option ${k + 1} scores ${n}, outside the 0–${max} range set by scaleMax.`);
    }
  });
  if (errors.length) return errors;

  // The answer stores only the number, so the score is also the IDENTITY of
  // the anchor that was chosen — it is what the read-back view looks the
  // wording up by. Two anchors worth the same are indistinguishable once
  // stored, and the reader would be shown whichever happened to come first:
  // words attributed to a rater who chose the other one.
  if (new Set(scores).size !== scores.length) {
    errors.push(`${where}: two or more options carry the same score — each option needs a distinct score.`);
  }
  return errors;
}

/**
 * The subset of a request body a caller may set. `family`, `version`,
 * `isLatest` and `isDefault` are deliberately absent: they are the versioning
 * machinery's own state. A caller-supplied `isDefault` would collide on the
 * partial unique index and silently change which form every future cycle
 * falls back to.
 */
function pickWritableFields(body) {
  return {
    name: body?.name,
    description: body?.description,
    sections: body?.sections,
  };
}

/**
 * `req.params.id` is caller-controlled. Handing a non-ObjectId string straight
 * to a Mongoose filter raises a CastError, and the global handler in server.js
 * deliberately leaves CastError untranslated — so an obviously malformed id
 * would answer 500 for what is plainly a bad request. Guarded here rather than
 * routed around, matching `cycleProgress` in appraisalCycle.controller.js, the
 * only other appraisal handler that validates the id it was given.
 *
 * 400 rather than 404: a valid-but-unknown or foreign-tenant id already 404s
 * below, and keeping those two apart costs nothing — a malformed id cannot
 * distinguish an existing document from a missing one, so it leaks nothing
 * across the tenant boundary.
 */
function rejectMalformedId(req, res) {
  if (mongoose.Types.ObjectId.isValid(req.params.id)) return false;
  res.status(400).json({ success: false, message: 'Invalid form id' });
  return true;
}

/**
 * Every "act on the whole family" query has to survive a template written
 * before Phase 3, which has no `family` at all — the field is required with no
 * default, so nothing backfills it until the migration script runs, and such a
 * row is still reachable by id through an old cycle's `template` ref. Mongoose
 * STRIPS undefined out of a filter, so the obvious `{tenant, family:
 * row.family}` would silently collapse to `{tenant}` and sweep in every form
 * the tenant owns — as a version list, or as an archive. Fall back to the row
 * itself: a template with no family is correctly its own only version.
 */
function familyFilter(tenantId, row) {
  return row.family
    ? { tenant: tenantId, family: row.family }
    : { tenant: tenantId, _id: row._id };
}

/**
 * Has any cycle pinned to THIS version already launched?
 *
 * This is the single predicate that decides whether an edit saves in place or
 * forks a new version. `updateTemplate` branches on it, and `getTemplate`
 * reports it as `hasLaunchedCycle` so the editor can warn HR *before* they
 * save rather than after — the response's `forked` flag only ever describes a
 * save that already happened. Extracted rather than written twice precisely so
 * the warning and the behaviour cannot drift apart: a banner that predicts a
 * fork the server then declines to perform is worse than no banner.
 *
 * `{launchedAt: {$ne: null}}` would express this in one `exists`, but the
 * cardinality here is a handful of cycles per pinned version, so reading the
 * flag and testing it in JS costs nothing and keeps the predicate legible.
 */
async function hasLaunchedCycleFor(tenantId, templateId) {
  const pinnedCycles = await AppraisalCycle.find({
    tenant: tenantId,
    template: templateId,
  })
    .select('launchedAt')
    .lean();
  return pinnedCycles.some((c) => c.launchedAt);
}

// Exported for scripts that edit a stored template out-of-band (see
// scripts/fix-appraisal-template-person-wording.js). Such a script must make
// the same in-place-vs-fork decision `updateTemplate` makes, and re-deriving
// the predicate there is exactly the drift this function was extracted to
// prevent. Named, not routed: the router references handlers explicitly.
exports.hasLaunchedCycleFor = hasLaunchedCycleFor;

exports.listTemplates = async (req, res, next) => {
  try {
    const rows = await AppraisalTemplate.find({
      tenant: req.tenant._id,
      isLatest: true,
      isArchived: false,
    })
      .sort({ isDefault: -1, name: 1 })
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getTemplate = async (req, res, next) => {
  try {
    if (rejectMalformedId(req, res)) return;
    const row = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });

    // Reported so the editor can tell HR that saving will create version N+1
    // BEFORE they save. The response's `forked` flag cannot serve that purpose
    // — it only ever describes a save that has already happened, by which
    // point the warning is useless. Same helper updateTemplate branches on.
    const hasLaunchedCycle = await hasLaunchedCycleFor(req.tenant._id, row._id);
    res.json({ success: true, data: { ...row, hasLaunchedCycle } });
  } catch (err) { next(err); }
};

exports.listVersions = async (req, res, next) => {
  try {
    if (rejectMalformedId(req, res)) return;
    const row = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).select('family').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });

    const versions = await AppraisalTemplate.find(familyFilter(req.tenant._id, row))
      .select('_id version isLatest isArchived name createdBy createdAt')
      .sort({ version: -1 })
      .lean();
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const fields = pickWritableFields(req.body);
    const errors = validateTemplateShape(fields.sections);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' '), fields: ['sections'] });
    }

    const created = await AppraisalTemplate.create({
      ...fields,
      tenant: req.tenant._id,
      family: new mongoose.Types.ObjectId(),
      version: 1,
      isLatest: true,
      isDefault: false,
      isArchived: false,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) { next(err); }
};

/**
 * Edit a form — in place, or by forking a new version.
 *
 * The branch is one question: has any cycle pinned to THIS version actually
 * launched? Not launched → edit in place. Launched → fork, because appraisals
 * exist and reviewers may have the form open, so an edit is already capable of
 * changing a question under someone mid-answer even before anything is
 * submitted.
 *
 * Two deliberate choices in that query:
 *  - it matches on `template` (the concrete pinned version), not
 *    `templateFamily`. A cycle launched against v1 says nothing about v2, and
 *    matching the family would fork on every save forever once the family had
 *    ever been used.
 *  - `launchedAt`, not `status`. createCycle pins `template` the moment the
 *    cycle row is created, so a draft already carries a pin — but launchCycle
 *    re-resolves that pin to the family's current latest, so a draft cannot be
 *    holding a form open in front of anybody.
 *
 * `sections[]._id` / `questions[]._id` are carried over from the request body
 * verbatim, NOT reminted. A question's id is its identity across versions: the
 * comparison feature reads the same id under `askOf: ['self']` and
 * `['manager']`, and answers already stored against v1's ids have to keep
 * resolving after a fork. Reminting would silently orphan every one of them.
 * Questions genuinely added in the builder arrive with no id and Mongoose mints
 * one as normal.
 */
exports.updateTemplate = async (req, res, next) => {
  try {
    if (rejectMalformedId(req, res)) return;

    const current = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).lean();
    if (!current) return res.status(404).json({ success: false, message: 'Form not found' });

    // Editing a superseded version would fork from stale content and produce a
    // version that silently discards whatever the newer one changed. Tested
    // against an explicit `false` rather than falsiness: a pre-Phase-3 row has
    // no `isLatest` field at all and is still the only version there is.
    if (current.isLatest === false) {
      return res.status(400).json({
        success: false,
        message: 'This is an older version of the form. Open the current version to edit it.',
      });
    }

    const fields = pickWritableFields(req.body);
    const errors = validateTemplateShape(fields.sections);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join(' '), fields: ['sections'] });
    }

    // The same predicate getTemplate reports as `hasLaunchedCycle`, so the
    // editor's pre-save warning and this branch cannot disagree.
    const launched = await hasLaunchedCycleFor(req.tenant._id, current._id);

    if (!launched) {
      const saved = await AppraisalTemplate.findOneAndUpdate(
        { _id: current._id, tenant: req.tenant._id },
        { $set: { ...fields } },
        { new: true, runValidators: true }
      );
      if (!saved) return res.status(404).json({ success: false, message: 'Form not found' });
      // A hydrated document's own enumerable properties are {$__, _doc}, not
      // schema paths, so anything that spreads it must go through toObject().
      return res.json({ success: true, data: saved.toObject ? saved.toObject() : saved });
    }

    // Two-document write: clear the old isLatest, then insert the new version.
    // The {tenant, family} partial unique index makes two isLatest rows
    // impossible to write, so a non-atomic fork does not corrupt data — it
    // fails halfway, and a crash between the two leaves the family with NO
    // latest version, which is what createCycle resolves against.
    const session = await mongoose.startSession();
    // Only the id crosses the transaction boundary, and it is assigned (never
    // accumulated) inside the callback — the idiom launchCycle settled on after
    // a `created.push(...)` inside a retried callback double-counted in
    // Phase 1. The committed row is re-read afterwards so the response can
    // never describe a document a rolled-back attempt produced.
    let forkedId = null;
    try {
      await session.withTransaction(async () => {
        // Re-read INSIDE the callback. withTransaction re-runs the whole
        // callback on a transient error, and the rollback discards the writes
        // of the failed attempt — a document loaded outside would be reused
        // across attempts and write into an orphan.
        const fresh = await AppraisalTemplate.findOne({
          _id: current._id,
          tenant: req.tenant._id,
        })
          .session(session)
          .lean();
        if (!fresh) {
          throw Object.assign(new Error('Form not found'), { statusCode: 404 });
        }

        // A pre-Phase-3 row has neither field. Treat it as its own family's v1
        // — the same identity the backfill script assigns — and repair the old
        // row in the same transaction, so the family does not end up split
        // between a family-less v1 and a v2 that points at nothing.
        const family = fresh.family || fresh._id;
        const baseVersion = fresh.version || 1;

        const siblings = await AppraisalTemplate.find({ tenant: req.tenant._id, family })
          .select('version')
          .session(session)
          .lean();
        const nextVersion = siblings.reduce(
          (max, row) => Math.max(max, row.version || 0),
          baseVersion
        ) + 1;

        // Order matters: clear before inserting, or the unique index rejects.
        await AppraisalTemplate.updateOne(
          { _id: fresh._id, tenant: req.tenant._id },
          { $set: { isLatest: false, family, version: baseVersion } },
          { session }
        );
        const [next] = await AppraisalTemplate.create([{
          ...fields,
          tenant: req.tenant._id,
          family,
          version: nextVersion,
          isLatest: true,
          // The default family stays the default across versions. The
          // {tenant, isDefault} unique index is partial on
          // {isDefault: true, isLatest: true}, so this is only safe because the
          // old row's isLatest was cleared immediately above, inside the same
          // transaction.
          isDefault: fresh.isDefault === true,
          isArchived: false,
          createdBy: req.user._id,
        }], { session });
        forkedId = next._id;
      });
    } finally {
      session.endSession();
    }

    const saved = await AppraisalTemplate.findOne({
      _id: forkedId,
      tenant: req.tenant._id,
    }).lean();
    res.json({ success: true, data: { ...saved, forked: true } });
  } catch (err) { next(err); }
};

/**
 * Archive every version of the family. Archiving means "do not offer for new
 * cycles"; it does not affect reads, so a historical cycle still resolves its
 * pinned version by _id and renders exactly as before.
 */
exports.archiveTemplate = async (req, res, next) => {
  try {
    if (rejectMalformedId(req, res)) return;

    const row = await AppraisalTemplate.findOne({
      _id: req.params.id,
      tenant: req.tenant._id,
    }).select('family isDefault').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Form not found' });

    // The default is what createCycle falls back to when HR names no form.
    // Archiving it would make ensureDefaultTemplate seed a second one and
    // quietly change which questions every future cycle asks.
    if (row.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'The default form cannot be archived. Make another form the default first.',
      });
    }

    await AppraisalTemplate.updateMany(
      familyFilter(req.tenant._id, row),
      { $set: { isArchived: true } }
    );
    res.json({ success: true, data: { family: row.family || null, archived: true } });
  } catch (err) { next(err); }
};

// ───────────────────────────────────────────────────────────────────────────
// AI generation
//
// Three drafting aids for the form builder, mounted on the same admin-gated
// templateRouter as the write routes. None of them writes to the database:
// each returns a sanitized DRAFT for the editor to preview and for HR to
// accept or discard. The versioning machinery is untouched — the existing save
// path still owns the fork.
//
// Shape copied from `fillWithAI` in brand.controller.js: guard the key,
// construct the client per request, demand a bare JSON object, brace-slice the
// response, and answer a clear message rather than throwing when the model
// returns something unusable.
// ───────────────────────────────────────────────────────────────────────────
const Anthropic = require('@anthropic-ai/sdk');
const {
  SYSTEM_PROMPT,
  parseAiJson,
  sanitizeGeneratedTemplate,
  sanitizeGeneratedSection,
  mergeQuestionAssist,
  buildTemplatePrompt,
  buildSectionPrompt,
  buildQuestionPrompt,
} = require('../services/appraisalAi.service');

// Same model the brand / category / subcategory ai-fill endpoints use.
const AI_MODEL = 'claude-haiku-4-5';

/**
 * Runs one generation and hands back the parsed JSON, or writes the response
 * itself and returns null. Callers must `return` immediately on null.
 */
async function generateJson(res, { prompt, maxTokens }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY is not configured' });
    return null;
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content || []).map((c) => c.text || '').join('');
  const json = parseAiJson(raw);
  if (!json) {
    res.status(500).json({ success: false, message: 'AI returned invalid JSON' });
    return null;
  }
  return json;
}

/** Whatever HR ticked in the brief, narrowed to the enum. */
function pickAudiences(body) {
  const raw = Array.isArray(body && body.audiences) ? body.audiences : [];
  return ['self', 'manager', 'peer'].filter((k) => raw.includes(k));
}

/**
 * HR's deliberate "yes, peers should score too" override. Off unless ticked:
 * the generator otherwise scopes scored questions to self+manager, matching
 * the seeded default template. Without this flag peer scoring would be
 * silently impossible rather than merely discouraged.
 */
function pickAllowPeerScoring(body) {
  return Boolean(body && body.allowPeerScoring);
}

/**
 * The tenant's real department ids, for the AI sanitizer to snap a generated
 * section's `departments` against (Phase 5 §9.1). Queried per generation
 * rather than passed in the body: a client-supplied roster of "valid"
 * departments would defeat the point of validating against one.
 */
async function tenantDepartmentIds(req) {
  if (!req.tenant?._id) return [];
  const rows = await Department.find({ tenant: req.tenant._id }).select('_id').lean();
  return rows.map((r) => r._id);
}

/** POST /api/appraisal-templates/ai/template — generate a whole form. */
exports.aiGenerateTemplate = async (req, res, next) => {
  try {
    const audiences = pickAudiences(req.body);
    const allowPeerScoring = pickAllowPeerScoring(req.body);
    const brief = {
      role: req.body?.role,
      department: req.body?.department,
      purpose: req.body?.purpose,
      notes: req.body?.notes,
      sectionCount: req.body?.sectionCount,
      questionsPerSection: req.body?.questionsPerSection,
      audiences,
      allowPeerScoring,
    };
    if (!brief.role && !brief.purpose && !brief.notes) {
      return res.status(400).json({
        success: false,
        message: 'Describe the role or the purpose of this review so the draft has something to work from.',
      });
    }

    const json = await generateJson(res, { prompt: buildTemplatePrompt(brief), maxTokens: 8192 });
    if (!json) return;

    const draft = sanitizeGeneratedTemplate(json, {
      audiences, allowPeerScoring, departmentIds: await tenantDepartmentIds(req),
    });
    // Everything the model produced failed the invariants. Say so plainly —
    // handing HR an empty draft would read as a successful generation.
    if (draft.sections.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'AI returned no usable questions. Try again with a more specific brief.',
      });
    }
    res.json({ success: true, data: draft });
  } catch (err) { next(err); }
};

/** POST /api/appraisal-templates/ai/section — a new section, or more questions for one. */
exports.aiGenerateSection = async (req, res, next) => {
  try {
    const audiences = pickAudiences(req.body);
    const allowPeerScoring = pickAllowPeerScoring(req.body);
    const input = {
      role: req.body?.role,
      department: req.body?.department,
      notes: req.body?.notes,
      questionCount: req.body?.questionCount,
      expandSectionTitle: req.body?.expandSectionTitle,
      // The whole current draft, so the model cannot re-ask what is already
      // on the form. Sanitizing dedupes too, but a question dropped as a
      // duplicate is a wasted slot — better that it is never written.
      existingSections: req.body?.existingSections,
      audiences,
      allowPeerScoring,
    };

    const json = await generateJson(res, { prompt: buildSectionPrompt(input), maxTokens: 4096 });
    if (!json) return;

    const seenLabels = new Set();
    for (const s of Array.isArray(input.existingSections) ? input.existingSections : []) {
      for (const q of Array.isArray(s && s.questions) ? s.questions : []) {
        const label = typeof q?.label === 'string' ? q.label.trim().toLowerCase() : '';
        if (label) seenLabels.add(label);
      }
    }

    const section = sanitizeGeneratedSection(json, {
      audiences, seenLabels, allowPeerScoring, departmentIds: await tenantDepartmentIds(req),
    });
    if (!section) {
      return res.status(500).json({
        success: false,
        message: 'AI returned no usable questions for this section. Try again.',
      });
    }
    res.json({ success: true, data: section });
  } catch (err) { next(err); }
};

/** POST /api/appraisal-templates/ai/question — rewrite a label, propose options, suggest askOf. */
exports.aiAssistQuestion = async (req, res, next) => {
  try {
    const audiences = pickAudiences(req.body);
    const allowPeerScoring = pickAllowPeerScoring(req.body);
    const mode = ['label', 'options', 'askOf'].includes(req.body?.mode) ? req.body.mode : 'label';
    const question = req.body?.question;
    if (!question || typeof question !== 'object') {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    const json = await generateJson(res, {
      prompt: buildQuestionPrompt({
        mode,
        question,
        audiences,
        allowPeerScoring,
        role: req.body?.role,
        sectionTitle: req.body?.sectionTitle,
      }),
      maxTokens: 1500,
    });
    if (!json) return;

    const merged = mergeQuestionAssist(question, json, { mode, audiences, allowPeerScoring });
    if (!merged) {
      return res.status(500).json({
        success: false,
        message: 'AI returned nothing usable for this question. Try again.',
      });
    }
    // `_id` is the question's identity across template versions and across
    // reviewer kinds — answers already stored reference it. The sanitizer
    // never emits one, so carry HR's through untouched.
    if (question._id) merged._id = question._id;
    res.json({ success: true, data: merged });
  } catch (err) { next(err); }
};

exports.validateTemplateShape = validateTemplateShape;
exports.pickWritableFields = pickWritableFields;
