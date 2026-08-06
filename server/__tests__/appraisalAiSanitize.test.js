// server/__tests__/appraisalAiSanitize.test.js
//
// The AI generation endpoints hand raw LLM output to the AppraisalTemplate
// schema. An unconstrained model reproduces exactly the failure modes this
// module already knows about — an enum value the schema would 500 on, a
// competency scoped away from `self` so `filterSectionsForKind` drops it off
// the self form and `buildComparison` has nothing to compare, a `choice` with
// one option that `review-question-card.tsx` renders as an authoring error.
//
// These tests feed the sanitizers adversarial output. No network: the service
// is prompt building + sanitizing only, so every rule here is exercised
// without an API key.
const test = require('node:test');
const assert = require('node:assert');
const {
  sanitizeGeneratedQuestion,
  sanitizeGeneratedSection,
  sanitizeGeneratedTemplate,
  mergeQuestionAssist,
  parseAiJson,
  buildTemplatePrompt,
  buildSectionPrompt,
  buildQuestionPrompt,
} = require('../services/appraisalAi.service');

const ALL = ['self', 'manager', 'peer'];

// ---------------------------------------------------------------------------
// sanitizeGeneratedQuestion — type enum
// ---------------------------------------------------------------------------
test('question: keeps every valid type', () => {
  for (const type of ['rating', 'text', 'likert', 'choice', 'yes_no', 'scale']) {
    const raw = { type, label: `A ${type} question`, askOf: ALL };
    if (type === 'choice') raw.options = ['Yes', 'No'];
    const q = sanitizeGeneratedQuestion(raw, { audiences: ALL });
    assert.ok(q, `${type} should survive`);
    assert.equal(q.type, type);
  }
});

test('question: drops an out-of-enum type rather than letting the schema 500', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'multiple_choice', label: 'Pick one', askOf: ALL },
    { audiences: ALL }
  );
  assert.equal(q, null);
});

test('question: drops a missing/blank label', () => {
  assert.equal(sanitizeGeneratedQuestion({ type: 'text', askOf: ALL }, { audiences: ALL }), null);
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'text', label: '   ', askOf: ALL }, { audiences: ALL }),
    null
  );
});

test('question: drops null / non-object input', () => {
  assert.equal(sanitizeGeneratedQuestion(null, { audiences: ALL }), null);
  assert.equal(sanitizeGeneratedQuestion('a string', { audiences: ALL }), null);
});

test('question: truncates label to 300 and helpText to 500', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'L'.repeat(900), helpText: 'H'.repeat(900), askOf: ALL },
    { audiences: ALL }
  );
  assert.equal(q.label.length, 300);
  assert.equal(q.helpText.length, 500);
});

test('question: omits helpText entirely when the model returned an empty one', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Anything', helpText: '  ', askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(!('helpText' in q));
});

// ---------------------------------------------------------------------------
// askOf
// ---------------------------------------------------------------------------
test('question: intersects askOf with the audiences HR requested', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Open comment', askOf: ALL },
    { audiences: ['self', 'manager'] }
  );
  assert.deepEqual(q.askOf, ['self', 'manager']);
});

test('question: strips askOf values outside the enum', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Open comment', askOf: ['self', 'skip_level', 'customer'] },
    { audiences: ALL }
  );
  assert.deepEqual(q.askOf, ['self']);
});

test('question: drops a question nobody is asked', () => {
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'text', label: 'Dead weight', askOf: [] }, { audiences: ALL }),
    null
  );
  // askOf entirely outside the requested audiences leaves nothing behind.
  assert.equal(
    sanitizeGeneratedQuestion(
      { type: 'text', label: 'Dead weight', askOf: ['peer'] },
      { audiences: ['self', 'manager'] }
    ),
    null
  );
});

test('question: a missing askOf defaults to the requested audiences', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Open comment' },
    { audiences: ['self', 'manager'] }
  );
  assert.deepEqual(q.askOf, ['self', 'manager']);
});

test('question: askOf comes back in canonical self/manager/peer order', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Open comment', askOf: ['peer', 'manager', 'self'] },
    { audiences: ALL }
  );
  assert.deepEqual(q.askOf, ['self', 'manager', 'peer']);
});

// ---------------------------------------------------------------------------
// The 360 bug: a scored question must keep `self`
// ---------------------------------------------------------------------------
test('question: adds self BACK to a scored question when HR asked for self', () => {
  // This is the exact shape the 360 preset shipped with and had to be fixed:
  // an LLM writing a competency scopes it to raters only, which drops the
  // whole thing off the self form and leaves buildComparison nothing to
  // compare against.
  for (const type of ['rating', 'likert', 'scale']) {
    const q = sanitizeGeneratedQuestion(
      { type, label: 'Sets a clear direction for the team', askOf: ['manager', 'peer'] },
      { audiences: ALL }
    );
    assert.ok(q, `${type} should survive`);
    assert.deepEqual(q.askOf, ['self', 'manager', 'peer'], `${type} must regain self`);
  }
});

test('question: does NOT add self back when HR did not ask for a self form', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'rating', label: 'Sets a clear direction', askOf: ['manager', 'peer'] },
    { audiences: ['manager', 'peer'] }
  );
  assert.deepEqual(q.askOf, ['manager', 'peer']);
});

test('question: does NOT add self back to an unscored type', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'text', label: 'What should this person keep doing?', askOf: ['manager', 'peer'] },
    { audiences: ALL }
  );
  assert.deepEqual(q.askOf, ['manager', 'peer']);
});

test('question: drops a scored question left with only self when raters were requested', () => {
  // Self-only competency: nothing to compare against, so it is dead weight on
  // a form that HR built to collect manager/peer scores.
  const q = sanitizeGeneratedQuestion(
    { type: 'rating', label: 'Self-rated only', askOf: ['self'] },
    { audiences: ALL }
  );
  assert.equal(q, null);
});

test('question: KEEPS a self-only scored question on a self-only form', () => {
  // HR asked for a self-assessment and nothing else. There is no comparison
  // to protect, so enforcing "needs a rater" would empty the whole template.
  const q = sanitizeGeneratedQuestion(
    { type: 'rating', label: 'Rate your own delivery', askOf: ['self'] },
    { audiences: ['self'] }
  );
  assert.ok(q);
  assert.deepEqual(q.askOf, ['self']);
});

// ---------------------------------------------------------------------------
// scaleMax
// ---------------------------------------------------------------------------
test('question: clamps a runaway scaleMax into the schema 2..10 window', () => {
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'rating', label: 'X', scaleMax: 900, askOf: ALL }, { audiences: ALL })
      .scaleMax,
    10
  );
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'rating', label: 'X', scaleMax: 1, askOf: ALL }, { audiences: ALL })
      .scaleMax,
    2
  );
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'rating', label: 'X', scaleMax: -4, askOf: ALL }, { audiences: ALL })
      .scaleMax,
    2
  );
});

test('question: defaults a missing or unparseable scaleMax to 5', () => {
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'rating', label: 'X', askOf: ALL }, { audiences: ALL }).scaleMax,
    5
  );
  assert.equal(
    sanitizeGeneratedQuestion(
      { type: 'rating', label: 'X', scaleMax: 'five', askOf: ALL },
      { audiences: ALL }
    ).scaleMax,
    5
  );
});

test('question: rounds a fractional scaleMax', () => {
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'rating', label: 'X', scaleMax: 4.6, askOf: ALL }, { audiences: ALL })
      .scaleMax,
    5
  );
});

test('question: does not put scaleMax on a type that has no scale', () => {
  for (const type of ['text', 'choice', 'yes_no']) {
    const raw = { type, label: 'X', scaleMax: 7, askOf: ALL };
    if (type === 'choice') raw.options = ['A', 'B'];
    const q = sanitizeGeneratedQuestion(raw, { audiences: ALL });
    assert.ok(!('scaleMax' in q), `${type} must not carry scaleMax`);
  }
});

// ---------------------------------------------------------------------------
// choice options
// ---------------------------------------------------------------------------
test('question: caps a 47-option choice at 8 options', () => {
  const options = Array.from({ length: 47 }, (_, i) => `Option ${i + 1}`);
  const q = sanitizeGeneratedQuestion(
    { type: 'choice', label: 'Pick', options, askOf: ALL },
    { audiences: ALL }
  );
  assert.equal(q.options.length, 8);
  assert.equal(q.options[0], 'Option 1');
});

test('question: truncates each option to 200 chars', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'choice', label: 'Pick', options: ['A'.repeat(500), 'B'], askOf: ALL },
    { audiences: ALL }
  );
  assert.equal(q.options[0].length, 200);
});

test('question: drops a choice with fewer than two usable options', () => {
  assert.equal(
    sanitizeGeneratedQuestion(
      { type: 'choice', label: 'Pick', options: ['Only one'], askOf: ALL },
      { audiences: ALL }
    ),
    null
  );
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'choice', label: 'Pick', options: [], askOf: ALL }, { audiences: ALL }),
    null
  );
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'choice', label: 'Pick', askOf: ALL }, { audiences: ALL }),
    null
  );
  // Blank and duplicate entries do not count toward the two.
  assert.equal(
    sanitizeGeneratedQuestion(
      { type: 'choice', label: 'Pick', options: ['Yes', '  ', 'yes'], askOf: ALL },
      { audiences: ALL }
    ),
    null
  );
});

test('question: coerces multiple to a boolean and only on choice', () => {
  const c = sanitizeGeneratedQuestion(
    { type: 'choice', label: 'Pick', options: ['A', 'B'], multiple: 'yes', askOf: ALL },
    { audiences: ALL }
  );
  assert.equal(c.multiple, true);
  const t = sanitizeGeneratedQuestion(
    { type: 'text', label: 'Say', multiple: true, askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(!('multiple' in t));
});

test('question: does not put options on a non-choice type', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'rating', label: 'X', options: ['A', 'B'], askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(!('options' in q));
});

// ---------------------------------------------------------------------------
// scaleLabels
// ---------------------------------------------------------------------------
test('question: keeps scaleLabels only on likert/scale and truncates to 100', () => {
  const l = sanitizeGeneratedQuestion(
    {
      type: 'likert',
      label: 'X',
      scaleLabels: { low: 'L'.repeat(400), high: 'H'.repeat(400) },
      askOf: ALL,
    },
    { audiences: ALL }
  );
  assert.equal(l.scaleLabels.low.length, 100);
  assert.equal(l.scaleLabels.high.length, 100);

  const r = sanitizeGeneratedQuestion(
    { type: 'rating', label: 'X', scaleLabels: { low: 'Poor', high: 'Great' }, askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(!('scaleLabels' in r));
});

test('question: omits scaleLabels when both endpoints are empty', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'likert', label: 'X', scaleLabels: { low: '', high: '   ' }, askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(!('scaleLabels' in q));
});

test('question: survives a garbage scaleLabels value', () => {
  const q = sanitizeGeneratedQuestion(
    { type: 'likert', label: 'X', scaleLabels: 'strongly agree', askOf: ALL },
    { audiences: ALL }
  );
  assert.ok(q);
  assert.ok(!('scaleLabels' in q));
});

test('question: required defaults to true and coerces', () => {
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'text', label: 'X', askOf: ALL }, { audiences: ALL }).required,
    true
  );
  assert.equal(
    sanitizeGeneratedQuestion({ type: 'text', label: 'X', required: false, askOf: ALL }, { audiences: ALL })
      .required,
    false
  );
});

// ---------------------------------------------------------------------------
// sanitizeGeneratedSection
// ---------------------------------------------------------------------------
test('section: drops a section with no title', () => {
  assert.equal(
    sanitizeGeneratedSection({ questions: [{ type: 'text', label: 'X', askOf: ALL }] }, { audiences: ALL }),
    null
  );
  assert.equal(sanitizeGeneratedSection(null, { audiences: ALL }), null);
});

test('section: truncates the title to 200', () => {
  const s = sanitizeGeneratedSection(
    { title: 'T'.repeat(500), questions: [{ type: 'text', label: 'X', askOf: ALL }] },
    { audiences: ALL }
  );
  assert.equal(s.title.length, 200);
});

test('section: drops a section whose every question was rejected', () => {
  const s = sanitizeGeneratedSection(
    {
      title: 'Nothing usable',
      questions: [
        { type: 'multiple_choice', label: 'bad type', askOf: ALL },
        { type: 'choice', label: 'one option', options: ['A'], askOf: ALL },
        { type: 'text', askOf: ALL },
      ],
    },
    { audiences: ALL }
  );
  assert.equal(s, null);
});

test('section: drops a section with no questions array at all', () => {
  assert.equal(sanitizeGeneratedSection({ title: 'Empty' }, { audiences: ALL }), null);
});

test('section: caps questions at 12', () => {
  const questions = Array.from({ length: 30 }, (_, i) => ({
    type: 'text',
    label: `Question ${i + 1}`,
    askOf: ALL,
  }));
  const s = sanitizeGeneratedSection({ title: 'Runaway', questions }, { audiences: ALL });
  assert.equal(s.questions.length, 12);
});

test('section: drops duplicate labels case-insensitively', () => {
  const s = sanitizeGeneratedSection(
    {
      title: 'Repetitive',
      questions: [
        { type: 'text', label: 'Communication skills', askOf: ALL },
        { type: 'text', label: '  communication SKILLS  ', askOf: ALL },
        { type: 'text', label: 'Teamwork', askOf: ALL },
      ],
    },
    { audiences: ALL }
  );
  assert.equal(s.questions.length, 2);
  assert.deepEqual(
    s.questions.map((q) => q.label),
    ['Communication skills', 'Teamwork']
  );
});

test('section: dedupes against labels already used elsewhere in the template', () => {
  const seen = new Set(['communication skills']);
  const s = sanitizeGeneratedSection(
    {
      title: 'New section',
      questions: [
        { type: 'text', label: 'Communication skills', askOf: ALL },
        { type: 'text', label: 'Ownership', askOf: ALL },
      ],
    },
    { audiences: ALL, seenLabels: seen }
  );
  assert.deepEqual(
    s.questions.map((q) => q.label),
    ['Ownership']
  );
  // The caller's set is updated so the next section cannot repeat it either.
  assert.ok(seen.has('ownership'));
});

// ---------------------------------------------------------------------------
// sanitizeGeneratedTemplate
// ---------------------------------------------------------------------------
test('template: returns name, description and sanitized sections', () => {
  const out = sanitizeGeneratedTemplate(
    {
      name: 'Senior Engineer Annual Review',
      description: 'Annual performance review for senior engineers.',
      sections: [
        {
          title: 'Core Competencies',
          questions: [{ type: 'rating', label: 'Technical depth', askOf: ['manager'] }],
        },
      ],
    },
    { audiences: ALL }
  );
  assert.equal(out.name, 'Senior Engineer Annual Review');
  assert.equal(out.description, 'Annual performance review for senior engineers.');
  assert.equal(out.sections.length, 1);
  // The 360 rule still applies through the template entry point.
  assert.deepEqual(out.sections[0].questions[0].askOf, ['self', 'manager']);
});

test('template: truncates name to 200 and description to 2000', () => {
  const out = sanitizeGeneratedTemplate(
    {
      name: 'N'.repeat(500),
      description: 'D'.repeat(5000),
      sections: [{ title: 'S', questions: [{ type: 'text', label: 'X', askOf: ALL }] }],
    },
    { audiences: ALL }
  );
  assert.equal(out.name.length, 200);
  assert.equal(out.description.length, 2000);
});

test('template: caps sections at 8', () => {
  const sections = Array.from({ length: 20 }, (_, i) => ({
    title: `Section ${i + 1}`,
    questions: [{ type: 'text', label: `Question ${i + 1}`, askOf: ALL }],
  }));
  const out = sanitizeGeneratedTemplate({ name: 'Big', sections }, { audiences: ALL });
  assert.equal(out.sections.length, 8);
});

test('template: survives null sections and null input', () => {
  assert.deepEqual(sanitizeGeneratedTemplate({ name: 'X', sections: null }, { audiences: ALL }).sections, []);
  assert.deepEqual(sanitizeGeneratedTemplate(null, { audiences: ALL }).sections, []);
  assert.deepEqual(sanitizeGeneratedTemplate({ name: 'X', sections: 'nope' }, { audiences: ALL }).sections, []);
});

test('template: dedupes labels ACROSS sections, not just within one', () => {
  const out = sanitizeGeneratedTemplate(
    {
      name: 'Repetitive',
      sections: [
        { title: 'One', questions: [{ type: 'text', label: 'Communication', askOf: ALL }] },
        {
          title: 'Two',
          questions: [
            { type: 'text', label: 'communication', askOf: ALL },
            { type: 'text', label: 'Ownership', askOf: ALL },
          ],
        },
      ],
    },
    { audiences: ALL }
  );
  assert.equal(out.sections.length, 2);
  assert.deepEqual(
    out.sections[1].questions.map((q) => q.label),
    ['Ownership']
  );
});

test('template: a section emptied entirely by cross-section dedupe is dropped', () => {
  const out = sanitizeGeneratedTemplate(
    {
      name: 'Repetitive',
      sections: [
        { title: 'One', questions: [{ type: 'text', label: 'Communication', askOf: ALL }] },
        { title: 'Two', questions: [{ type: 'text', label: 'COMMUNICATION', askOf: ALL }] },
      ],
    },
    { audiences: ALL }
  );
  assert.equal(out.sections.length, 1);
});

test('template: defaults audiences to all three kinds when the caller names none', () => {
  const out = sanitizeGeneratedTemplate({
    name: 'X',
    sections: [{ title: 'S', questions: [{ type: 'text', label: 'Q', askOf: ALL }] }],
  });
  assert.deepEqual(out.sections[0].questions[0].askOf, ['self', 'manager', 'peer']);
});

// ---------------------------------------------------------------------------
// mergeQuestionAssist — per-question assist never rewrites what HR did not ask
// ---------------------------------------------------------------------------
test('assist: a label rewrite cannot change the question type', () => {
  const current = { type: 'rating', label: 'Communication', required: true, scaleMax: 5, askOf: ALL };
  const q = mergeQuestionAssist(
    current,
    { type: 'choice', label: 'Communicates decisions clearly to the team', options: ['A', 'B'] },
    { mode: 'label', audiences: ALL }
  );
  assert.equal(q.type, 'rating');
  assert.equal(q.label, 'Communicates decisions clearly to the team');
  assert.ok(!('options' in q));
});

test('assist: a label rewrite leaves askOf alone', () => {
  const current = { type: 'text', label: 'Old', required: true, askOf: ['manager'] };
  const q = mergeQuestionAssist(
    current,
    { label: 'New wording', askOf: ['self', 'manager', 'peer'] },
    { mode: 'label', audiences: ALL }
  );
  assert.deepEqual(q.askOf, ['manager']);
});

test('assist: an options run replaces options but not the label', () => {
  const current = { type: 'choice', label: 'Overall rating', options: ['Good'], required: true, askOf: ALL };
  const q = mergeQuestionAssist(
    current,
    { label: 'Something else entirely', options: ['Below', 'Meets', 'Exceeds'] },
    { mode: 'options', audiences: ALL }
  );
  assert.equal(q.label, 'Overall rating');
  assert.deepEqual(q.options, ['Below', 'Meets', 'Exceeds']);
});

test('assist: an askOf run replaces only askOf, and the 360 rule still applies', () => {
  const current = { type: 'rating', label: 'Leads by example', required: true, scaleMax: 5, askOf: ALL };
  const q = mergeQuestionAssist(
    current,
    { label: 'hijacked', askOf: ['manager', 'peer'] },
    { mode: 'askOf', audiences: ALL }
  );
  assert.equal(q.label, 'Leads by example');
  assert.deepEqual(q.askOf, ['self', 'manager', 'peer']);
});

test('assist: returns null when the merged result is unusable', () => {
  const current = { type: 'choice', label: 'Pick', options: ['A', 'B'], required: true, askOf: ALL };
  assert.equal(
    mergeQuestionAssist(current, { options: ['Only one'] }, { mode: 'options', audiences: ALL }),
    null
  );
  assert.equal(mergeQuestionAssist(current, null, { mode: 'label', audiences: ALL }), null);
});

test('assist: helpText comes along with a label rewrite', () => {
  const current = { type: 'text', label: 'Old', required: true, askOf: ALL };
  const q = mergeQuestionAssist(
    current,
    { label: 'New', helpText: 'Give a specific example.' },
    { mode: 'label', audiences: ALL }
  );
  assert.equal(q.helpText, 'Give a specific example.');
});

// ---------------------------------------------------------------------------
// parseAiJson — the brace-slice the ai-fill endpoints already use
// ---------------------------------------------------------------------------
test('parseAiJson: slices a JSON object out of markdown fences and prose', () => {
  const raw = 'Sure! Here you go:\n```json\n{"name":"X","sections":[]}\n```\nHope that helps.';
  assert.deepEqual(parseAiJson(raw), { name: 'X', sections: [] });
});

test('parseAiJson: returns null rather than throwing on unparseable output', () => {
  assert.equal(parseAiJson('I cannot help with that.'), null);
  assert.equal(parseAiJson('{ not json at all }'), null);
  assert.equal(parseAiJson(''), null);
  assert.equal(parseAiJson(null), null);
});

// ---------------------------------------------------------------------------
// Prompt builders — they must actually carry the constraints
// ---------------------------------------------------------------------------
test('buildTemplatePrompt: names the brief and the requested audiences', () => {
  const p = buildTemplatePrompt({
    role: 'Warehouse Supervisor',
    department: 'Logistics',
    purpose: 'Annual review',
    audiences: ['self', 'manager'],
    sectionCount: 4,
    questionsPerSection: 5,
  });
  assert.match(p, /Warehouse Supervisor/);
  assert.match(p, /Logistics/);
  assert.match(p, /Annual review/);
  assert.match(p, /self, manager/);
  assert.doesNotMatch(p, /"peer"/);
});

test('buildSectionPrompt: lists existing questions so the model cannot repeat them', () => {
  const p = buildSectionPrompt({
    role: 'Bartender',
    audiences: ALL,
    existingSections: [
      { title: 'Service Quality', questions: [{ label: 'Greets guests warmly' }] },
    ],
  });
  assert.match(p, /Service Quality/);
  assert.match(p, /Greets guests warmly/);
});

test('buildSectionPrompt: an expansion names the section it is expanding', () => {
  const p = buildSectionPrompt({
    role: 'Bartender',
    audiences: ALL,
    expandSectionTitle: 'Service Quality',
    existingSections: [
      { title: 'Service Quality', questions: [{ label: 'Greets guests warmly' }] },
    ],
  });
  assert.match(p, /Service Quality/);
  assert.match(p, /more questions/i);
});

test('buildQuestionPrompt: carries the current question and the assist mode', () => {
  const p = buildQuestionPrompt({
    mode: 'options',
    question: { type: 'choice', label: 'Overall rating', options: ['Good'] },
    audiences: ALL,
  });
  assert.match(p, /Overall rating/);
  assert.match(p, /choice/);
});
