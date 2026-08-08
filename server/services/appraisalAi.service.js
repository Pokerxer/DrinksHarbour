// server/services/appraisalAi.service.js — prompt building + sanitizing for
// the appraisal template AI generator.
//
// Deliberately makes NO HTTP calls. The controller owns the Anthropic client;
// this module owns everything worth testing, so every invariant below is
// exercised by __tests__/appraisalAiSanitize.test.js without an API key.
//
// Why sanitizing is not optional: raw LLM output goes straight into the
// AppraisalTemplate schema and then into reviewer forms, and an unconstrained
// model reproduces exactly the failure modes this module has already been
// bitten by —
//   * an out-of-enum `type` or an over-length label is a 500 on save;
//   * a competency scoped to raters only vanishes from the self form
//     (`filterSectionsForKind`) and leaves `buildComparison` nothing to
//     compare — the bug the `three-sixty` preset shipped with;
//   * a `choice` with one option renders an explicit authoring-error box in
//     `review-question-card.tsx`.

const { PEER_EVIDENCE_SECTION_TITLE, PEER_EVIDENCE_QUESTIONS } = require('./appraisal.helpers');

const KINDS = ['self', 'manager', 'peer'];
const TYPES = ['rating', 'text', 'likert', 'choice', 'yes_no', 'scale'];
// Types that produce a number an appraisal can average and compare across
// reviewer kinds. `yes_no` stores 1/0 but is not a rating scale, so it is not
// subject to the self-must-be-asked rule.
const SCORED_TYPES = ['rating', 'likert', 'scale'];

const MAX_SECTIONS = 8;
const MAX_QUESTIONS_PER_SECTION = 12;
const MAX_OPTIONS = 8;

// Schema maxlengths, mirrored from models/AppraisalTemplate.js.
const LIMITS = {
  name: 200,
  description: 2000,
  sectionTitle: 200,
  label: 300,
  helpText: 500,
  option: 200,
  scaleLabel: 100,
};

// ---------------------------------------------------------------------------
// Small coercers — same shape as `aiStr` in brand.controller.js
// ---------------------------------------------------------------------------
function aiStr(v, max) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return '';
  return String(v).trim().slice(0, max);
}

function requestedAudiences(opts) {
  const raw = Array.isArray(opts && opts.audiences) ? opts.audiences : null;
  const picked = raw ? KINDS.filter((k) => raw.includes(k)) : [];
  // A caller that names no audience gets the schema default: everyone.
  return picked.length ? picked : [...KINDS];
}

/**
 * HR's explicit "yes, I do want peers to score this" opt-in. Default false:
 * the house rule below is what a tenant gets unless they say otherwise, which
 * is the same stance `buildDefaultTemplate` takes (peer-scored askOf is
 * editable there, just not the default).
 */
function peerScoringAllowed(opts) {
  return Boolean(opts && opts.allowPeerScoring);
}

/**
 * The brace-slice parse the existing ai-fill endpoints use: models wrap JSON
 * in prose or markdown fences no matter how firmly the system prompt forbids
 * it. Returns null rather than throwing so callers answer a clean
 * "AI returned invalid JSON" instead of a 500 from the error handler.
 */
function parseAiJson(raw) {
  if (typeof raw !== 'string') return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------
/**
 * Sanitize one generated question, or return null to DROP it.
 *
 * Dropping is always preferred to repairing something the model plainly got
 * wrong: a half-invented question in HR's draft is worse than one fewer.
 */
function sanitizeGeneratedQuestion(raw, opts) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const type = TYPES.includes(raw.type) ? raw.type : null;
  if (!type) return null;

  const label = aiStr(raw.label, LIMITS.label);
  if (!label) return null;

  const audiences = requestedAudiences(opts);

  // askOf: enum ∩ what HR asked for. An absent askOf means "everyone HR asked
  // for", matching the schema default rather than silently narrowing.
  const proposed = Array.isArray(raw.askOf) ? raw.askOf : audiences;
  let askOf = audiences.filter((k) => proposed.includes(k));

  if (SCORED_TYPES.includes(type) && !peerScoringAllowed(opts) && askOf.includes('peer')) {
    // THE HOUSE RULE, matching buildDefaultTemplate: scored questions are for
    // the employee and their manager, never a peer. A peer in another function
    // has no basis to score "quality of work"; a required question leaves them
    // no honest way out, so they guess, and the guess is averaged into a mean
    // that reads as measurement. Peers get evidence-shaped text instead.
    //
    // Generated and seeded forms have to agree on this or the form a tenant
    // gets depends on whether HR clicked "generate".
    askOf = askOf.filter((k) => k !== 'peer');
    // Manager takes peer's place. Without this a question the model scoped
    // ['self','peer'] collapses to ['self'] and is then killed outright by the
    // no-rater rule below — the strip would delete competencies rather than
    // re-aim them. `audiences` is still respected: a form HR built without a
    // manager does not grow one.
    if (audiences.includes('manager') && !askOf.includes('manager')) {
      askOf = KINDS.filter((k) => k === 'manager' || askOf.includes(k));
    }
  }

  if (SCORED_TYPES.includes(type)) {
    // THE 360 RULE. A model writing "Sets a clear direction for the team"
    // reads it as something only raters answer and scopes it
    // ['manager','peer']. That drops the question — and, if every question in
    // the section goes the same way, the whole section — off the self form,
    // which is precisely what broke the shipped 360 preset. If HR asked for a
    // self form, a scored question is asked of self, full stop.
    if (audiences.includes('self') && !askOf.includes('self')) {
      askOf = KINDS.filter((k) => k === 'self' || askOf.includes(k));
    }
    // ...and the converse: a scored question answered ONLY by the subject has
    // nothing to compare against on a form built to collect rater scores.
    const raters = audiences.filter((k) => k !== 'self');
    if (raters.length && !askOf.some((k) => k !== 'self')) return null;
  }

  if (askOf.length === 0) return null;

  const out = {
    type,
    label,
    required: raw.required === undefined ? true : Boolean(raw.required),
    askOf,
  };

  const helpText = aiStr(raw.helpText, LIMITS.helpText);
  if (helpText) out.helpText = helpText;

  if (type === 'rating' || type === 'likert' || type === 'scale') {
    const n = Math.round(Number(raw.scaleMax));
    out.scaleMax = Number.isFinite(n) ? Math.min(10, Math.max(2, n)) : 5;
  }

  if (type === 'likert' || type === 'scale') {
    const src = raw.scaleLabels && typeof raw.scaleLabels === 'object' ? raw.scaleLabels : {};
    const low = aiStr(src.low, LIMITS.scaleLabel);
    const high = aiStr(src.high, LIMITS.scaleLabel);
    if (low || high) {
      out.scaleLabels = {};
      if (low) out.scaleLabels.low = low;
      if (high) out.scaleLabels.high = high;
    }
  }

  if (type === 'choice') {
    const seen = new Set();
    const options = [];
    for (const o of Array.isArray(raw.options) ? raw.options : []) {
      const text = aiStr(o, LIMITS.option);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(text);
      if (options.length === MAX_OPTIONS) break;
    }
    // review-question-card.tsx renders an authoring-error box for a choice
    // with nothing to choose between. Never hand HR one.
    if (options.length < 2) return null;
    out.options = options;
    out.multiple = Boolean(raw.multiple);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------
/**
 * Sanitize one generated section, or return null to DROP it.
 *
 * `opts.seenLabels` is a Set of already-used lowercased labels and is MUTATED
 * as questions are accepted — that is what makes dedupe work across sections
 * of one generated template, not merely within a section. Pass the same Set
 * across calls; omit it and dedupe is section-local.
 */
function sanitizeGeneratedSection(raw, opts) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const title = aiStr(raw.title, LIMITS.sectionTitle);
  if (!title) return null;
  if (!Array.isArray(raw.questions)) return null;

  const seenLabels = (opts && opts.seenLabels) || new Set();
  const questions = [];

  for (const rawQuestion of raw.questions) {
    if (questions.length === MAX_QUESTIONS_PER_SECTION) break;
    const q = sanitizeGeneratedQuestion(rawQuestion, opts);
    if (!q) continue;
    const key = q.label.toLowerCase();
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);
    questions.push(q);
  }

  if (questions.length === 0) return null;
  return { title, questions };
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------
/**
 * Sanitize a whole generated template. Always returns an object; `sections`
 * may be empty, which the controller treats as "the model returned nothing
 * usable" rather than handing HR a blank draft.
 */
function sanitizeGeneratedTemplate(raw, opts) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const audiences = requestedAudiences(opts);
  const allowPeerScoring = peerScoringAllowed(opts);
  const seenLabels = (opts && opts.seenLabels) || new Set();

  const sections = [];
  for (const rawSection of Array.isArray(src.sections) ? src.sections : []) {
    if (sections.length === MAX_SECTIONS) break;
    const s = sanitizeGeneratedSection(rawSection, { audiences, seenLabels, allowPeerScoring });
    if (s) sections.push(s);
  }

  // PEER COVERAGE — the mirror image of the 360 bug. Stripping peer off every
  // scored question can leave a peer with nothing to answer at all;
  // `filterSectionsForKind` then returns [] and they open a blank review form.
  //
  // Checked here and not in sanitizeGeneratedSection because one section of
  // pure competencies legitimately has no peer questions — it is the whole
  // TEMPLATE having none that is broken.
  //
  // Only on a draft that already has something in it: `sections: []` is how
  // the controller learns the model returned nothing usable, and rescuing that
  // into two canned questions would report a failed generation as a success.
  const peerCovered = sections.some((s) => s.questions.some((q) => q.askOf.includes('peer')));
  if (audiences.includes('peer') && sections.length && !peerCovered) {
    const fresh = PEER_EVIDENCE_QUESTIONS.filter((q) => !seenLabels.has(q.label.toLowerCase()));
    const source = fresh.length ? fresh : PEER_EVIDENCE_QUESTIONS;
    for (const q of source) seenLabels.add(q.label.toLowerCase());
    // Appended past MAX_SECTIONS if the draft hit the cap: the cap bounds what
    // the MODEL produced (the schema puts no limit on section count), and a
    // peer who cannot answer anything is a broken form, not a long one.
    sections.push({
      title: PEER_EVIDENCE_SECTION_TITLE,
      questions: source.map((q) => ({ ...q, askOf: ['peer'] })),
    });
  }

  const out = { name: aiStr(src.name, LIMITS.name), sections };
  const description = aiStr(src.description, LIMITS.description);
  if (description) out.description = description;
  return out;
}

/**
 * Merge a per-question assist proposal onto the question HR already has, then
 * sanitize the result. Returns null when nothing usable came back.
 *
 * Only the keys the assist was asked for are taken from the model. HR clicked
 * "rewrite this label", not "regenerate this question" — letting a label run
 * also flip the type, swap the options or re-scope `askOf` would silently undo
 * authoring decisions the user made deliberately. The full merged question is
 * still put through `sanitizeGeneratedQuestion` so the 360 rule and every
 * schema bound apply to the result, not just to the changed field.
 */
function mergeQuestionAssist(current, proposal, opts) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return null;
  const base = current && typeof current === 'object' ? { ...current } : {};
  const mode = ['label', 'options', 'askOf'].includes(opts && opts.mode) ? opts.mode : 'label';

  if (mode === 'label') {
    base.label = proposal.label;
    if (proposal.helpText !== undefined) base.helpText = proposal.helpText;
  } else if (mode === 'options') {
    base.options = proposal.options;
    if (proposal.multiple !== undefined) base.multiple = proposal.multiple;
  } else {
    base.askOf = proposal.askOf;
  }

  // A label or options run must not quietly un-scope a peer rating HR authored
  // deliberately — that is the "silently impossible" failure `allowPeerScoring`
  // exists to prevent, and HR asked for new wording, not a new audience. An
  // `askOf` run is different: there HR asked the model to re-decide who
  // answers, so house style governs the answer.
  const keepsPeerScoring =
    mode !== 'askOf' && Array.isArray(base.askOf) && base.askOf.includes('peer');

  return sanitizeGeneratedQuestion(base, keepsPeerScoring ? { ...opts, allowPeerScoring: true } : opts);
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT =
  'You are an HR performance-management expert helping build employee appraisal forms. ' +
  'You know performance review best practice: 3-5 observable competencies per section, ' +
  'behavioural rather than personality-based wording, unipolar 5-point scales, and ' +
  'open-text prompts that ask for specific examples. ' +
  'Respond with ONLY a single valid JSON object — no prose, no markdown fences.';

/**
 * Which reviewer kinds may carry a SCORED question on a form with these
 * audiences, mirroring what `sanitizeGeneratedQuestion` will actually allow.
 *
 * `noScoring` is the case worth naming: a form whose only rater is a peer has
 * nobody left who may score, so the right instruction is "write no scored
 * questions" rather than a rule the model will read as "include a rater" and
 * satisfy with the one kind it must not use.
 */
function scoringPlan(audiences, opts) {
  const scoredKinds = peerScoringAllowed(opts)
    ? audiences
    : audiences.filter((k) => k !== 'peer');
  const scoredRaters = scoredKinds.filter((k) => k !== 'self');
  return {
    scoredKinds,
    comparable: scoredKinds.includes('self') && scoredRaters.length > 0,
    noScoring: scoredRaters.length === 0 && audiences.some((k) => k !== 'self'),
  };
}

/**
 * Shared tail: the exact question object the sanitizers will accept.
 *
 * The sanitizers are a backstop, not the specification. A model that writes a
 * peer rating anyway does not break anything — the question is silently
 * re-scoped — but the slot is wasted and HR gets a shorter draft than they
 * asked for. Every rule the sanitizer enforces is stated here first.
 */
function questionContract(audiences, opts) {
  const list = audiences.join(', ');
  const hasPeer = audiences.includes('peer');
  const allowPeerScoring = peerScoringAllowed(opts);

  const { scoredKinds, comparable, noScoring } = scoringPlan(audiences, opts);
  // The comparison rationale only lands when both sides of the comparison are
  // on the form. On a manager-only or self-only form it reads as a non sequitur
  // and invites the model to add the missing kind back.
  const why = comparable
    ? ' A scored competency the employee does not also rate cannot be compared against their reviewers, which is the entire point of the form.'
    : '';

  const scoredRule = noScoring
    ? `- Do NOT write any rating, likert or scale question on this form. The only reviewers besides the employee are peers, and peers do not score. Use text questions throughout.`
    : allowPeerScoring
      ? `- Every rating, likert and scale question MUST include ${audiences.includes('self') ? 'self plus at least one other reviewer kind' : 'every reviewer kind that can judge it'} in "askOf".${why}`
      : `- Every rating, likert and scale question MUST have "askOf": [${scoredKinds.map((k) => `"${k}"`).join(', ')}] — exactly those, no more and no fewer.${why}`;

  // Stated only when peers are actually on this form — a self+manager form has
  // no peers to write text questions for, and mentioning them just invites a
  // section nobody can answer.
  const peerRules =
    hasPeer && !allowPeerScoring
      ? [
          '- Never include "peer" in the "askOf" of a rating, likert or scale question. A peer in another team has no basis to score a competency like "quality of work"; asked anyway they guess, and the guess is averaged into a number that reads as measurement. Scores are for the manager, who has the context to calibrate them.',
          '- Give peers open-text questions instead, and ask for evidence rather than an impression: one specific incident the peer personally observed ("Think of a specific time..."), not an overall view of the person. At least one question on the form must be scoped "askOf": ["peer"], or peers open a blank form.',
        ]
      : hasPeer
        ? [
            '- HR has asked for peer scoring on this form, so peers may appear in the "askOf" of rating, likert and scale questions. Only include them where a peer could genuinely observe what the question asks about.',
            '- Also give peers at least one open-text question asking for one specific incident they personally observed ("Think of a specific time..."), not an overall impression.',
          ]
        : [];

  // Reviewers already have a native abstain (AppraisalFeedback.answers
  // .notObserved), which buildComparison excludes from the denominator. A
  // modelled "N/A" is a second, worse way to say the same thing — it counts as
  // a real answer, and the reviewer now has two controls competing for it.
  const abstainRule =
    '- Do NOT invent an "N/A", "Not applicable", "Did not observe" or "Unable to judge" answer option, choice or scale point. Reviewers already have a built-in control for saying they did not observe something; a question that models it as an option duplicates that control and competes with it.';

  return `Each question object has these keys:
  "type": one of rating | text | likert | choice | yes_no | scale
  "label": the question as the reviewer reads it (max ${LIMITS.label} chars)
  "helpText": one short sentence of guidance, or "" (max ${LIMITS.helpText} chars)
  "required": true or false
  "scaleMax": integer 2-10 (only for rating, likert and scale; use 5 unless there is a reason not to)
  "scaleLabels": { "low": "...", "high": "..." } endpoint labels, max ${LIMITS.scaleLabel} chars each (only for likert and scale)
  "options": array of 2-${MAX_OPTIONS} short strings (ONLY for choice — a choice question with fewer than 2 options is discarded)
  "multiple": true if a choice question allows several selections
  "askOf": array naming which reviewers answer it, drawn ONLY from: ${list}

Rules you must follow:
${scoredRule}
${peerRules.join('\n')}${peerRules.length ? '\n' : ''}${abstainRule}
- Never use a "type" outside the six listed. Never use an "askOf" value outside the list above.
- Do not repeat a question label anywhere in the form.
- Write labels as observable behaviours ("Communicates decisions clearly to the team"), never personality traits ("Is a nice person").`;
}

function buildTemplatePrompt(brief) {
  const b = brief || {};
  const audiences = requestedAudiences(b);
  const sectionCount = Math.min(MAX_SECTIONS, Math.max(2, Number(b.sectionCount) || 4));
  const perSection = Math.min(
    MAX_QUESTIONS_PER_SECTION,
    Math.max(2, Number(b.questionsPerSection) || 4)
  );

  const lines = [
    b.role ? `- Role being reviewed: ${aiStr(b.role, 200)}` : null,
    b.department ? `- Department: ${aiStr(b.department, 200)}` : null,
    b.purpose ? `- Purpose of the review: ${aiStr(b.purpose, 400)}` : null,
    b.notes ? `- Extra context from HR: ${aiStr(b.notes, 1000)}` : null,
    `- Reviewers who will fill this form in: ${audiences.join(', ')}`,
    `- Rough size: ${sectionCount} sections, about ${perSection} questions each`,
  ].filter(Boolean);

  return `Design a complete employee performance appraisal form.

${lines.join('\n')}

Return a JSON object with exactly these keys:
{
  "name": "short name for this form (max ${LIMITS.name} chars), e.g. Senior Bartender Annual Review",
  "description": "one or two sentences telling HR what this form is for (max ${LIMITS.description} chars)",
  "sections": [ { "title": "section heading (max ${LIMITS.sectionTitle} chars)", "questions": [ ... ] } ]
}

Produce ${sectionCount} sections. Give each a heading an HR manager would recognise (competencies, goals, strengths and development, overall assessment). ${
    scoringPlan(audiences, b).noScoring
      ? 'Every question is open text on this form, so make each one ask for something different and concrete rather than restating the last.'
      : 'Mix scored questions with at least one open-text question per form so reviewers can give specific examples.'
  }${
    audiences.includes('peer')
      ? ` One of those sections must be for peers: give it a plain heading like "${PEER_EVIDENCE_SECTION_TITLE}" and fill it with open-text questions scoped "askOf": ["peer"].`
      : ''
  }

${questionContract(audiences, b)}`;
}

function buildSectionPrompt(input) {
  const b = input || {};
  const audiences = requestedAudiences(b);
  const expanding = aiStr(b.expandSectionTitle, LIMITS.sectionTitle);
  const count = Math.min(MAX_QUESTIONS_PER_SECTION, Math.max(2, Number(b.questionCount) || 4));

  const existing = (Array.isArray(b.existingSections) ? b.existingSections : [])
    .map((s) => {
      const title = aiStr(s && s.title, LIMITS.sectionTitle) || 'Untitled section';
      const qs = (Array.isArray(s && s.questions) ? s.questions : [])
        .map((q) => aiStr(q && q.label, LIMITS.label))
        .filter(Boolean)
        .map((l) => `    - ${l}`)
        .join('\n');
      return `  ${title}\n${qs || '    (no questions yet)'}`;
    })
    .join('\n');

  const context = [
    b.role ? `- Role being reviewed: ${aiStr(b.role, 200)}` : null,
    b.department ? `- Department: ${aiStr(b.department, 200)}` : null,
    b.notes ? `- What HR wants this section to cover: ${aiStr(b.notes, 1000)}` : null,
    `- Reviewers who will fill this form in: ${audiences.join(', ')}`,
  ].filter(Boolean);

  const task = expanding
    ? `Write ${count} more questions for the existing section titled "${expanding}". Return that same title unchanged as "title", and put ONLY the new questions in "questions" — do not repeat the ones it already has.`
    : `Write one NEW section of ${count} questions to add to this form. Choose a heading that covers ground the form is missing.`;

  return `${task}

The form already contains these sections and questions. Every question you write must be genuinely different from all of them — no rephrasings:
${existing || '  (the form is empty)'}

${context.join('\n')}

Return a JSON object with exactly these keys:
{
  "title": "section heading (max ${LIMITS.sectionTitle} chars)",
  "questions": [ ... ]
}

${questionContract(audiences, b)}`;
}

/**
 * Per-question assist. `mode` picks what the model is being asked for, but the
 * response shape is always a whole question object: the controller sanitizes
 * the model's proposal MERGED onto the question HR already has, so a rewritten
 * label cannot smuggle in a broken type or an askOf nobody is asked.
 */
function buildQuestionPrompt(input) {
  const b = input || {};
  const audiences = requestedAudiences(b);
  const q = (b.question && typeof b.question === 'object' ? b.question : {}) || {};
  const mode = ['label', 'options', 'askOf'].includes(b.mode) ? b.mode : 'label';

  const current = [
    `- type: ${aiStr(q.type, 40) || 'rating'}`,
    `- label: ${aiStr(q.label, LIMITS.label) || '(blank)'}`,
    q.helpText ? `- helpText: ${aiStr(q.helpText, LIMITS.helpText)}` : null,
    Array.isArray(q.options) && q.options.length
      ? `- options: ${q.options.map((o) => aiStr(o, LIMITS.option)).filter(Boolean).join(' | ')}`
      : null,
    Array.isArray(q.askOf) && q.askOf.length ? `- askOf: ${q.askOf.join(', ')}` : null,
  ].filter(Boolean);

  const task = {
    label:
      'Rewrite the label so it describes an observable behaviour a reviewer can actually judge, and add a one-sentence helpText. Keep the same subject matter and the same type.',
    options:
      `Propose 3-${MAX_OPTIONS} answer options for this question, ordered worst to best where that makes sense. Keep each option short.`,
    askOf:
      'Decide which reviewers should answer this question and return it in "askOf". Only choose reviewers who can genuinely observe what it asks about.',
  }[mode];

  const context = [
    b.role ? `- Role being reviewed: ${aiStr(b.role, 200)}` : null,
    b.sectionTitle ? `- Section it sits in: ${aiStr(b.sectionTitle, LIMITS.sectionTitle)}` : null,
    `- Reviewers who will fill this form in: ${audiences.join(', ')}`,
  ].filter(Boolean);

  return `Improve one question on an employee appraisal form.

${task}

The question as it stands:
${current.join('\n')}

${context.join('\n')}

Return the COMPLETE improved question as a single JSON object — every key it needs, not just the ones you changed.

${questionContract(audiences, b)}`;
}

module.exports = {
  KINDS,
  TYPES,
  SCORED_TYPES,
  MAX_SECTIONS,
  MAX_QUESTIONS_PER_SECTION,
  MAX_OPTIONS,
  LIMITS,
  SYSTEM_PROMPT,
  parseAiJson,
  sanitizeGeneratedQuestion,
  sanitizeGeneratedSection,
  sanitizeGeneratedTemplate,
  mergeQuestionAssist,
  buildTemplatePrompt,
  buildSectionPrompt,
  buildQuestionPrompt,
};
