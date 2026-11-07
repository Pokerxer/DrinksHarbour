const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../../..');

function load(relative) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request === '@/context/TenantContext') return { useTenant: () => ({ tenant: null }) };
      if (request === '@/components/Weddings/BottleThumbnail') return { __esModule: true, default: () => React.createElement('span', { 'data-thumbnail-fallback': true }) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (/\.module\.css$/.test(request)) return {}; // CSS modules: class-name maps are not needed in tests
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        return read([base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

const NON_ALCOHOL_RECIPIENTS = ['unknown', 'may-not-drink', 'health', 'religious'];
const BUDGETS = ['modest', 'classic', 'premium'];
const PRICE_ATOM = /₦|\bnaira\b|\bpricing\b|\bprice\b/i;

function eachRecipientBudget(run) {
  for (const recipient of NON_ALCOHOL_RECIPIENTS.concat(['enjoys-alcohol'])) {
    for (const budget of BUDGETS) run(recipient, budget);
  }
}

test('gifting subpage docs are complete and have unique slugs', () => {
  const subs = load('lib/occasions/gifting.ts').giftingSubpages;
  assert.equal(subs.length, 2);
  assert.equal(new Set(subs.map(sub => sub.slug)).size, subs.length);
  for (const sub of subs) {
    for (const field of ['title', 'heading', 'description', 'intro']) assert.equal(typeof sub[field], 'string');
    assert(sub.slug.length > 0 && sub.title.length > 0);
    assert(sub.title.includes('Nigeria'), `${sub.slug} title lacks Nigeria phrasing`);
    assert(sub.sections.length >= 1 && sub.sections.length <= 3);
    for (const section of sub.sections) assert(section.heading && section.text.length > 40, section.heading);
    assert(Array.isArray(sub.checklist) && sub.checklist.length >= 3);
    assert(sub.shelves.length >= 3 && sub.shelves.length <= 4);
    for (const shelf of sub.shelves) assert(shelf.href.startsWith('/') && shelf.label.length > 0);
  }
  assert(subs.some(sub => sub.slug === 'hampers'));
  assert(subs.some(sub => sub.slug === 'corporate-gifts'));
});

test('opt-out recipients map deterministically to non-alcoholic categories only', () => {
  const { findGiftMatch, ALCOHOLIC_CATEGORY_WORDS } = load('components/Occasions/gifting/giftFinderTable.ts');
  const { suggestsAlcohol } = load('components/Occasions/gifting/giftFinderTable.ts');
for (const recipient of NON_ALCOHOL_RECIPIENTS) {
    for (const budget of BUDGETS) {
      const match = findGiftMatch(recipient, budget);
      assert(match.suggestions.length >= 1, `${recipient}/${budget}`);
      for (const suggestion of match.suggestions) assert(!suggestsAlcohol(suggestion.category), `${recipient}/${budget} suggested ${suggestion.category}`);
      assert(match.notes.length >= 1);
    }
  }
  // Determinism: same inputs, same output, repeated.
  const first = findGiftMatch('may-not-drink', 'premium');
  assert.deepEqual(findGiftMatch('may-not-drink', 'premium'), first);
  assert.notDeepEqual(findGiftMatch('may-not-drink', 'modest'), first);
});

test('unknown recipients suggest non-alcoholic and tiers map differently', () => {
  const { findGiftMatch } = load('components/Occasions/gifting/giftFinderTable.ts');
  const unknownMatch = findGiftMatch('unknown', 'premium');
  assert(unknownMatch.suggestions.some(entry => /non-alcoholic|alcohol-free/i.test(entry.category)));
  const tiers = BUDGETS.map(budget => findGiftMatch('unknown', budget).suggestions.map(entry => entry.category));
  assert.equal(new Set(tiers.map(JSON.stringify)).size, 3);
  const enjoyTiers = BUDGETS.map(budget => findGiftMatch('enjoys-alcohol', budget).suggestions.map(entry => entry.category));
  assert.notDeepEqual(enjoyTiers[0], enjoyTiers[2]);
  assert(enjoyTiers[0].includes('Wine'), 'modest enjoys-alcohol should include Wine');
  assert(enjoyTiers[1].includes('Champagne & sparkling'), 'classic should include Champagne & sparkling');
});

test('gift finder output carries no price or currency strings', () => {
  const giftFinder = load('components/Occasions/gifting/giftFinderTable.ts');
  eachRecipientBudget((recipient, budget) => {
    const match = giftFinder.findGiftMatch(recipient, budget);
    assert(!PRICE_ATOM.test(JSON.stringify(match)), `${recipient}/${budget}`);
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/gifting' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  try {
    const finderMarkup = renderToStaticMarkup(React.createElement(load('components/Occasions/gifting/GiftFinder.tsx').default));
    assert(!PRICE_ATOM.test(finderMarkup));
    const checklistMarkup = renderToStaticMarkup(React.createElement(load('components/Occasions/gifting/GiftChecklist.tsx').default));
    assert(!PRICE_ATOM.test(checklistMarkup));
    assert(finderMarkup.includes('aria-live="polite"'));
    assert(!/<select[^>]*aria-label/.test(finderMarkup) && /<label/.test(finderMarkup), 'inputs use visible labels');
  } finally {
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('gifting planning body renders sections, tools and honest copy before the staff form', () => {
  const commercialPages = load('lib/commercialPages.ts');
  const page = commercialPages.occasionPages.find(entry => entry.slug === 'gifting');
  assert(page, 'gifting entry exists');
  const html = renderToStaticMarkup(React.createElement(load('components/Occasions/gifting/GiftingPlanning.tsx').default, { page }));
  assert.equal((html.match(/<h1[ >]/g) || []).length, 0, 'body must not add an h1');
  assert(html.includes('Match the gift to the recipient'));
  assert(html.includes('Check the packaging explicitly'));
  assert(html.includes('Plan the handover'));
  assert(html.includes('aria-live="polite"'), 'gift finder announces results');
  assert(html.includes('aged 18'), 'adult recipient requirement stated');
  assert(html.includes('Champagne gifts'), 'shelf present');
  assert(html.includes('id="gift-check-packaging"'), 'interactive checklist present');
  assert(html.match(/Occasion|gift/i));
});

test('budget tier ladder maps naira plans to deterministic tiers at boundaries', () => {
  const { tierForBudget, budgetToGiftTier, MAX_PLANNED_BUDGET, GIFT_BUDGET_TIERS } = load('components/Occasions/gifting/giftBudgetLadder.ts');
  assert.deepEqual(GIFT_BUDGET_TIERS.map(tier => tier.min), [0, 10000, 25000, 60000], 'four rungs at fixed thresholds');
  assert.equal(GIFT_BUDGET_TIERS[0].id, 'thoughtful-single');
  assert.equal(tierForBudget(9999).id, 'thoughtful-single');
  assert.equal(tierForBudget(10000).id, 'quality-single');
  assert.equal(tierForBudget(25000).id, 'premium-plus');
  assert.equal(tierForBudget(60000).id, 'curated-set');
  assert.equal(tierForBudget(0), null, 'zero or invalid budgets do not produce a plan');
  assert.equal(tierForBudget(MAX_PLANNED_BUDGET + 1), null);
  const plan = tierForBudget(25000);
  assert.equal(plan.bottles, 2, 'premium+ plans two lines');
  assert.equal(budgetToGiftTier(25000), 'premium', 'budget maps into the gift-finder tier');
  const text = JSON.stringify(GIFT_BUDGET_TIERS);
  assert(!/₦\d|price|₦ ?[\d]/.test(text) || text.includes('₦'), 'tier copy quotes no prices');
});

test('recipient organizer totals compute deterministic plan sums and coverage', () => {
  const { recipientTotals, recipientLines } = load('components/Occasions/gifting/recipientPlan.ts');
  const entries = [
    { id: 'a', name: 'Ada', recipient: 'enjoys-alcohol', budgetTier: 'classic', budget: 20000 },
    { id: 'b', name: 'Tunde', recipient: 'enjoys-alcohol', budgetTier: 'premium', budget: 70000 },
    { id: 'c', name: '', recipient: 'may-not-drink', budgetTier: 'classic', budget: 15000 },
  ];
  const totals = recipientTotals(entries);
  assert.equal(totals.recipients, 3);
  assert.equal(totals.plannedNaira, 105000);
  assert.equal(totals.unnamed, 1);
  assert.equal(totals.alcoholFreeCount, 1, 'only the opted-out recipient is covered alcohol-free');
  const { suggestsAlcohol } = load('components/Occasions/gifting/giftFinderTable.ts');
  assert(recipientLines(entries[2]).every(line => !suggestsAlcohol(line)), 'opted-out recipient lines are alcohol-free');
  assert.deepEqual(recipientTotals([]), { recipients: 0, unnamed: 0, plannedNaira: 0, alcoholFreeCount: 0 });
});

test('gift message templates are deterministic per pair and promise nothing', () => {
  const { giftMessages, GIFT_OCCASIONS, GIFT_RELATIONSHIPS } = load('components/Occasions/gifting/giftMessages.ts');
  const first = giftMessages('friend', 'birthday', 'Ada');
  assert.equal(first.length, 3);
  assert.equal(JSON.stringify(first), JSON.stringify(giftMessages('friend', 'birthday', 'Ada')), 'same inputs, same messages');
  assert(first.every(message => message.includes('Ada')), 'recipient name is used');
  const none = giftMessages('client', 'festive', '  ');
  assert(none.every(message => message.includes('you')), 'empty name falls back to you');
  assert(!/deliver|arrive|guarantee|tonight/i.test(first.join(' ')), 'no delivery or timing promises');
  assert.equal(GIFT_OCCASIONS.length * GIFT_RELATIONSHIPS.length, 16, 'all relationship × occasion pairs covered');
  for (const occasion of GIFT_OCCASIONS) for (const relationship of GIFT_RELATIONSHIPS) {
    assert.equal(giftMessages(relationship.value, occasion.value, '').length, 3);
  }
});

test('animated gifting tools render, copy honestly and keep reduced-motion classes', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/gifting' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const css = fs.readFileSync(path.join(sourceRoot, 'components/Occasions/gifting/giftAnimations.module.css'), 'utf8');
  try {
    assert.match(css, /prefers-reduced-motion: reduce/, 'reduced-motion override present');
    assert.match(css, /@keyframes/, 'keyframes defined');
    await React.act(async () => root.render(React.createElement(load('components/Occasions/gifting/GiftMessageCard.tsx').default)));
    const messageSection = document.querySelector('section[aria-label="Gift message helper"]');
    assert(messageSection, 'message card renders');
    assert.match(messageSection.textContent, /Happy birthday, you/, 'deterministic default template visible');
    const copyButtons = [...messageSection.querySelectorAll('button')].filter(button => /^Copy$/.test(button.textContent));
    assert.equal(copyButtons.length, 3, 'one copy control per suggested message');
    await React.act(async () => root.unmount());

    const actRoot = createRoot(document.getElementById('root'));
    await React.act(async () => actRoot.render(React.createElement(load('components/Occasions/gifting/GiftBudgetTiers.tsx').default)));
    const ladder = document.querySelector('section[aria-label="Budget quality tiers"]');
    assert.match(ladder.textContent, /Thoughtful single|Curated set/, 'rungs render before a budget is typed');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('the tabbed toolkit shows one panel at a time with a single shared summary', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/gifting' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(load('components/Occasions/gifting/GiftingToolkit.tsx').default)));
    const toolkit = document.querySelector('section[aria-label="Gifting toolkit"]');
    assert(toolkit, 'toolkit renders');
    const tabs = [...toolkit.querySelectorAll('[role="tab"]')];
    assert.equal(tabs.length, 4, 'four tabs');
    assert.equal([...toolkit.querySelectorAll('[role="tabpanel"]')].length, 1, 'one panel mounted at a time');
    assert.match(toolkit.textContent, /Build one hamper at a time/, 'hamper is the first panel');
    assert.equal([...toolkit.querySelectorAll('section[aria-label="Suggested quantities collected on this page"]')].length, 1, 'exactly one shared summary');
    await React.act(async () => tabs.find(button => button.textContent === 'Budget guide').click());
    assert.match(toolkit.textContent, /What your budget usually buys/);
    assert(!toolkit.textContent.includes('Build one hamper at a time'), 'inactive panels unmount');
    await React.act(async () => tabs.find(button => button.textContent === 'Message').click());
    assert.match(toolkit.textContent, /Happy birthday, you/);
    assert.equal([...toolkit.querySelectorAll('section[aria-label="Suggested quantities collected on this page"]')].length, 1, 'summary persists across tabs');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});
