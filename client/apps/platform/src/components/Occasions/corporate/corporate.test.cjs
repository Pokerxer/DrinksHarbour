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

const loadCorporatePage = () => load('lib/commercialPages.ts').occasionPages.find(page => page.slug === 'corporate');

test('corporate subpage docs are complete, Nigeria-phrased and uniquely slugged', () => {
  const docs = load('lib/occasions/corporate.ts').corporateSubpages;
  assert.ok(Array.isArray(docs) && docs.length >= 2);
  const slugs = docs.map(doc => doc.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'subpage slugs must be unique');
  assert.deepEqual([...slugs].sort(), ['client-gifts', 'end-of-year-events']);
  for (const doc of docs) {
    for (const field of ['title', 'heading', 'description', 'intro']) assert.ok(String(doc[field]).length >= 20, `${doc.slug} ${field} too short`);
    assert.ok(doc.title.includes('in Nigeria'), `${doc.slug} title must use Nigeria search phrasing`);
    assert.ok(doc.description.includes('Nigeria'));
    assert.ok(doc.sections.length >= 2 && doc.sections.length <= 3, `${doc.slug} sections count`);
    for (const section of doc.sections) {
      assert.ok(section.heading && section.text, `${doc.slug} section completeness`);
    assert.ok(JSON.stringify(doc.sections).match(/confirm/i), `${doc.slug} copy should keep the confirm-before-ordering tone`);
    }
    assert.ok(Array.isArray(doc.checklist) && doc.checklist.length >= 3, `${doc.slug} checklist`);
    assert.ok(doc.shelves.length >= 3 && doc.shelves.length <= 4, `${doc.slug} shelf link count`);
    for (const shelf of doc.shelves) {
      assert.ok(shelf.href.startsWith('/') && shelf.label, `${doc.slug} shelf link shape`);
      if (shelf.href.startsWith('/shop?category=')) assert.match(shelf.href, /category=([a-z-]+)/);
    }
    assert.ok(JSON.stringify(doc).match(/18( or over|\+)/), `${doc.slug} must state the 18+ rule`);
  }
  // Honesty: the end-of-year doc must say an enquiry does not reserve stock or create credit.
  const events = docs.find(doc => doc.slug === 'end-of-year-events');
  assert.match(JSON.stringify(events), /does not reserve stock|does not create a credit account/);
  assert.match(JSON.stringify(events), /not guaranteed/);
});

test('CorporatePlanning renders a richer body from a commercialPages-shaped prop, without hero or shell', () => {
  const CorporatePlanning = load('components/Occasions/corporate/CorporatePlanning.tsx').default;
  const html = renderToStaticMarkup(React.createElement(CorporatePlanning, { page: loadCorporatePage() }));
  assert(!html.includes('<h1'), 'body must not contain the hero h1');
  assert(!html.includes('Breadcrumb'), 'body must not contain hero breadcrumbs');
  assert(!html.includes('Your order brief'), 'body must not duplicate the CommercialGuide shell');
  assert(!html.includes('occasion-planner'), 'body must not render the request form');
  assert(!html.includes('SubpageNav'), 'body must not render subpage navigation');
  for (const heading of ['Start from a purchasing brief', 'Order events and gifts differently', 'Procurement and invoice care',
    'End-of-year reception quantities', 'Your suggested quantities', 'Whisky for client gifts', 'Wine for receptions']) {
    assert(html.includes(heading), heading);
  }
  assert(html.includes('aged 18'), 'planning copy must keep the 18+ rule visible');
  for (const section of loadCorporatePage().sections) assert(!html.includes(section.heading), `generic corporate section "${section.heading}" should be replaced`);
  assert.match(html, /aria-live/);
  // Guarded to the corporate slug only.
  const empty = renderToStaticMarkup(React.createElement(CorporatePlanning, { page: { ...loadCorporatePage(), slug: 'weddings' } }));
  assert.equal(empty, '');
});

test('reception calculator maths follows guests × hours × share → bottles with roundTo', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/corporate' });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => { throw new Error('no sends in calculator test'); } });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const Tools = load('components/Occasions/corporate/CorporatePlanningTools.tsx').default;
  const setValue = (element, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  try {
    await React.act(async () => root.render(React.createElement(Tools, { calc: load('components/Occasions/corporate/calcConfig.ts').corporateEventCalc })));
    const calculator = document.querySelector('section[aria-label="End-of-year reception quantities"]');
    const readRow = category => Array.from(calculator.querySelectorAll('tbody tr')).find(row => row.textContent.includes(category)).querySelector('.text-right.font-bold').textContent;
    assert.equal(readRow('Sparkling wine'), '6 bottles'); // ceil(30/6)=5 → roundTo 6 keeps the purchase a full case
    assert.equal(readRow('Beer & lager'), '192 bottles');
    assert.equal(readRow('Table wine'), '20 bottles');
    assert.equal(readRow('Spirits for mixing'), '4 bottles');
    assert.equal(readRow('Water & soft drinks'), '240 bottles');
    // 100 guests × 2 hours recomputes every row (shares shape the estimate, roundTo keeps case multiples).
    const [guests, hours] = calculator.querySelectorAll('input[type="number"]');
    await React.act(async () => {
      setValue(guests, '100'); setValue(hours, '2');
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.equal(readRow('Water & soft drinks'), '216 bottles'); // 100×(1+1)=200 servings → ceil(200/24)×24
    assert.equal(readRow('Sparkling wine'), '12 bottles'); // ceil(50/6)=9 → ceil(9/6)×6
    assert.equal(readRow('Table wine'), '16 bottles');
    assert.equal(readRow('Spirits for mixing'), '3 bottles');
    assert.equal(readRow('Beer & lager'), '192 bottles'); // 60×(2+1)=180 → ceil(180/24)×24
    // Quantities join the collected list as names + counts only.
    const addAll = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Add all suggestions to your list');
    await React.act(async () => addAll.click());
    const summary = document.querySelector('section[aria-label="Suggested quantities collected on this page"]');
    for (const line of ['Sparkling wine for the welcome toast', 'Beer and lager for the reception', 'Red or white wine for the reception',
      'Whisky or gin for mixed drinks', 'Water and soft drinks for all guests']) {
      assert(summary.textContent.includes(line), line);
    }
    assert.match(summary.textContent, /12 bottles/);
    assert.match(summary.textContent, /216 bottles/);
    const clear = Array.from(summary.querySelectorAll('button')).find(button => button.textContent === 'Clear suggestions');
    assert.ok(clear);
    await React.act(async () => clear.click());
    assert(!summary.textContent.includes('Sparkling wine for the welcome toast'), 'clear must empty the list');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('planning-tool output stays quantity-only: no currency or price strings', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/corporate' });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, fetch: async () => { throw new Error('offline on purpose'); } });
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const CorporatePlanning = load('components/Occasions/corporate/CorporatePlanning.tsx').default;
  try {
    await React.act(async () => root.render(React.createElement(CorporatePlanning, { page: loadCorporatePage() })));
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    const text = document.body.textContent;
    assert(!text.includes('₦'), 'no naira sign in planning output');
    assert(!/naira/i.test(text), 'no naira wording in planning output');
    // Own quantity tools (calculator card + collected summary) — the shared shelf
    // disclaimer about seller prices lives outside this check by design.
    for (const scope of document.querySelectorAll('section[aria-label]')) {
      const label = scope.getAttribute('aria-label');
      if (label === 'End-of-year reception quantities' || label.startsWith('Suggested quantities collected')) {
        assert(!/price/i.test(scope.textContent), `no price strings inside "${(label)}"`);
      }
    }
    // Shelf fetch failure falls back to honest copy rather than a dead grid.
    assert.match(text, /could not load right now/);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});
