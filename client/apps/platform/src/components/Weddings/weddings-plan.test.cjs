const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../..');

function load(relative) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { role: 'customer' } }) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (request === 'next/image') return { __esModule: true, default: ({ fill, preload, ...props }) => React.createElement('img', props) };
      if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        const file = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(skip => fs.existsSync(skip) && fs.statSync(skip).isFile());
        return read(file || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

test('wedding subpage docs are complete with unique slugs and honest Nigeria-search titles', () => {
  const { weddingsSubpages } = load('lib/occasions/weddings.ts');
  assert.equal(weddingsSubpages.length, 2);
  const slugs = weddingsSubpages.map(entry => entry.slug);
  assert.equal(new Set(slugs).size, 2);
  for (const entry of weddingsSubpages) {
    for (const field of ['slug', 'title', 'heading', 'description', 'intro']) {
      const min = field === 'slug' ? 4 : 20;
      assert(entry[field] && String(entry[field]).length >= min, `${entry.slug}: ${field}`);
    }
    assert(entry.title.includes('in Nigeria'), `${entry.slug}: Nigeria-search phrasing`);
    assert.equal(entry.sections.length >= 2 && entry.sections.length <= 3, true, `${entry.slug}: 2-3 sections`);
    for (const section of entry.sections) assert(section.heading && section.text.length >= 40, `${entry.slug}: section body`);
    assert(entry.checklist.length >= 3, `${entry.slug}: checklist`);
    assert(entry.shelves.length >= 3 && entry.shelves.length <= 4, `${entry.slug}: 3-4 shelf links`);
    for (const shelf of entry.shelves) assert(shelf.href.startsWith('/') && shelf.label, `${entry.slug}: ${shelf.href}`);
    const copy = [entry.intro, ...entry.sections.map(section => section.text)].join(' ');
    assert(copy.includes('18'), `${entry.slug}: honest 18+ copy`);
    assert(/reserve|not.*guarantee/i.test(copy), `${entry.slug}: no-reservation or no-guarantee copy`);
  }
});

test('calculator math turns guests, hours and shares into case-rounded bottle counts', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/weddings' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const Calculator = load('components/Occasions/planning/GuestDrinkCalculator.tsx').default;
  const config = load('components/Weddings/planning.ts').weddingToastCalc;
  const added = [];
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  function setInput(value, position) {
    const input = document.querySelectorAll('input[type="number"]')[position];
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  }
  const suggested = () => [...document.querySelectorAll('tbody tr')].map(row => row.querySelector('td.text-right').textContent);
  try {
    await React.act(async () => root.render(React.createElement(Calculator, { config, onUse: choices => added.push(...choices) })));
    assert.deepEqual(suggested(), ['12 bottles', '36 bottles', '96 bottles', '4 bottles', '60 bottles', '132 bottles'], '60 guests, 4 hours defaults (toast, wine, beer, spirits, water, soft drinks)');
    assert.match(document.body.textContent, /60 servings ÷ 5 per bottle/, 'toast: one glass per guest');
    assert.match(document.body.textContent, /168 servings ÷ 5 per bottle/, 'meal share math');
    await React.act(async () => setInput('25', 0));
    await React.act(async () => setInput('2', 1));
    assert.deepEqual(suggested(), ['6 bottles', '12 bottles', '24 bottles', '1 bottle', '24 bottles', '36 bottles'], '25 guests, 2 hours, rounded to cases');
    await React.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Add all suggestions to your list').click());
    assert.deepEqual(added, [
      { name: 'Toast champagne or sparkling wine', suggestedQuantity: 6 },
      { name: 'Reception wine', suggestedQuantity: 12 },
      { name: 'Reception beer (bottles or cans)', suggestedQuantity: 24 },
      { name: 'Reception spirits (whisky, gin or vodka)', suggestedQuantity: 1 },
      { name: 'Bottled water', suggestedQuantity: 24 },
      { name: 'Soft drinks', suggestedQuantity: 36 },
    ], 'all rows reach the bottle list as name + quantity only');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('selected drink categories drive the calculator rows', async () => {
  const { rowsForSelection, uncoveredSelection, CATEGORY_TO_ROWS, OCCASION_DRINK_LABELS } = load('lib/occasions/categoryRows.ts');
  const full = load('components/Weddings/planning.ts').weddingToastCalc;
  // Nothing selected = identity.
  assert.equal(rowsForSelection(full, [], CATEGORY_TO_ROWS.weddings), full, 'empty selection keeps the full config');
  // Checked champagne + wine: only the two mapped rows survive.
  const filtered = rowsForSelection(full, ['toast', 'wine'], CATEGORY_TO_ROWS.weddings);
  assert.deepEqual(filtered.rows.map(row => row.id), ['toast', 'meal']);
  // Beer and spirits now have wedding rows so every checked category is covered.
  const bar = rowsForSelection(full, ['beer'], CATEGORY_TO_ROWS.weddings);
  assert.deepEqual(bar.rows.map(row => row.category), ['Beer']);
  const spirits = rowsForSelection(full, ['spirits'], CATEGORY_TO_ROWS.weddings);
  assert.deepEqual(spirits.rows.map(row => row.category), ['Spirits']);
  assert.deepEqual(uncoveredSelection(['beer', 'spirits'], CATEGORY_TO_ROWS.weddings), [], 'weddings covers beer and spirits');
  // house-parties has no champagne/toast row — surfaced honestly, never invented.
  assert.deepEqual(uncoveredSelection(['toast'], CATEGORY_TO_ROWS['house-parties']), ['toast']);
  assert.match(OCCASION_DRINK_LABELS.toast, /Champagne/);
  const uncoveredCalc = rowsForSelection(
    load('components/Occasions/house-parties/config.ts').housePartyCalcConfig,
    ['toast'], CATEGORY_TO_ROWS['house-parties'],
  );
  assert.equal(uncoveredCalc.rows.length, 0, 'selection with zero coverage shows the empty-table hint, not misleading full rows');
});

test('a selection-filtered calculator renders the honest uncovered note', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/weddings' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const Calculator = load('components/Occasions/planning/GuestDrinkCalculator.tsx').default;
  const { rowsForSelection, uncoveredSelection, CATEGORY_TO_ROWS, OCCASION_DRINK_LABELS } = load('lib/occasions/categoryRows.ts');
  const houseConfig = load('components/Occasions/house-parties/config.ts').housePartyCalcConfig;
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    const selection = ['toast'];
    const houseCovered = rowsForSelection(houseConfig, selection, CATEGORY_TO_ROWS['house-parties']);
    const note = `No draft quantity rows for ${uncoveredSelection(selection, CATEGORY_TO_ROWS['house-parties']).map(id => OCCASION_DRINK_LABELS[id]).join(', ').toLowerCase()} yet — mention them in the brief below and our team will plan them.`;
    await React.act(async () => root.render(React.createElement(Calculator, { config: houseCovered, onUse: () => {}, uncoveredNote: note })));
    const section = document.querySelector('section[aria-label="House party drink calculator"]');
    assert(section, 'calculator present');
    assert.match(section.textContent, /No draft quantity rows for champagne & sparkling yet/);
    assert.doesNotMatch(section.textContent, /Beers & cans/, 'uncovered-filtered rows are hidden, not shown as defaults');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('planning output stays quantity-only with no price or currency strings', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/weddings' });
  const prior = { window: global.window, document: global.document, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const Calculator = load('components/Occasions/planning/GuestDrinkCalculator.tsx').default;
  const config = load('components/Weddings/planning.ts').weddingToastCalc;
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(Calculator, { config, onUse: () => {} })));
    const section = document.querySelector('section[aria-label="Estimate your reception quantities"]');
    assert(section, 'calculator section present');
    const text = section.textContent;
    assert.match(text, /bottles/);
    assert.doesNotMatch(text, /₦|naira|price/i, 'no currency or price wording in planning output');
    for (const row of config.rows) for (const key of Object.keys(row)) assert.doesNotMatch(String(row[key]), /price|₦|naira/i, `row ${row.id} ${key}`);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});

test('SubpageNav renders the wedding subpage links from the docs', () => {
  const Nav = load('components/Occasions/planning/SubpageNav.tsx').default;
  const { weddingsSubpages } = load('lib/occasions/weddings.ts');
  const html = renderToStaticMarkup(React.createElement(Nav, {
    occasionPath: '/occasions/weddings', occasionLabel: 'Weddings', activeSlug: 'champagne',
    subpages: weddingsSubpages.map(entry => ({ slug: entry.slug, title: entry.title })),
  }));
  const dom = new JSDOM(html);
  try {
    const nav = dom.window.document.querySelector('nav');
    assert.equal(nav.getAttribute('aria-label'), 'Weddings subpages');
    const text = nav.textContent;
    const hrefs = [...nav.querySelectorAll('a')].map(link => link.getAttribute('href'));
    assert(hrefs.includes('/occasions/weddings#occasion-chat'));
    for (const entry of weddingsSubpages) {
      assert(hrefs.includes(`/occasions/weddings/${entry.slug}`), entry.slug);
      assert(text.includes(entry.title), entry.slug);
    }
    assert.equal(nav.querySelector('[aria-current="page"]').getAttribute('href'), '/occasions/weddings/champagne');
    for (const link of nav.querySelectorAll('a')) assert.match(link.className, /min-h-10/, 'touch targets');
  } finally { dom.window.close(); }
});

test('wedding page renders SubpageNav tabs below the hero', async () => {
  const { occasionPages } = load('lib/commercialPages.ts');
  const { weddingsSubpages } = load('lib/occasions/weddings.ts');
  const Page = load('components/Weddings/WeddingPage.tsx').default;
  const page = occasionPages.find(entry => entry.slug === 'weddings');
  const html = renderToStaticMarkup(React.createElement(Page, { page }));
  assert.match(html, /aria-label="Weddings subpages"/, 'SubpageNav mounted');
  for (const entry of weddingsSubpages) assert(html.includes(`href="/occasions/weddings/${entry.slug}"`), entry.slug);
  assert.match(html, /Estimate how much to plan for\./, 'quantities section present');
});

test('champagne shelf falls back to honest copy when the catalogue fetch fails', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/weddings' });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  global.fetch = async () => { throw new Error('offline'); };
  const Shelf = load('components/Occasions/planning/OccasionShelf.tsx').default;
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  try {
    await React.act(async () => root.render(React.createElement(Shelf, {
      label: 'Champagne for the toast', category: 'champagne', limit: 6,
      emptyHint: 'Champagne did not load just now. Browse champagne in the shop or ask support what is available for your date.',
      onAdd: () => true,
    })));
    assert.match(document.body.textContent, /Champagne did not load just now/, 'fallback copy');
    assert.match(document.body.textContent, /not reserved by browsing/, 'no stock reservation implied');
    assert.equal(document.querySelectorAll('a[href^="/product/"]').length, 0);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});
