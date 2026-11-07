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
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { role: 'customer' } }) };
      if (request === '@/context/TenantContext') return { useTenant: () => ({ tenant: null }) };
      if (request === '@/lib/fetchWithAuth') return { fetchWithAuth: (...args) => global.fetch(...args) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (request === 'next/image') return { __esModule: true, default: props => React.createElement('img', props) };
      if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
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

test('house-parties subpage docs are complete, honest and use unique Nigeria-phrased slugs', () => {
  const { housePartiesSubpages } = load('lib/occasions/house-parties.ts');
  assert.equal(housePartiesSubpages.length, 2);
  const slugs = housePartiesSubpages.map(entry => entry.slug);
  assert.deepEqual(slugs, ['cocktails', 'birthday']);
  for (const entry of housePartiesSubpages) {
    assert(entry.title.includes('Nigeria'), entry.slug + ' title must carry Nigeria search phrasing');
    for (const field of ['heading', 'description', 'intro']) assert.ok(String(entry[field]).length > 30, entry.slug + ' ' + field);
    assert.ok(entry.sections.length >= 2 && entry.sections.length <= 3, entry.slug + ' section count');
    for (const section of entry.sections) assert.ok(section.heading && section.text);
    assert.ok(entry.checklist.length >= 1, entry.slug + ' checklist');
    assert.ok(entry.shelves.length >= 3 && entry.shelves.length <= 4, entry.slug + ' shelf link count');
    for (const shelf of entry.shelves) assert.ok(shelf.href.startsWith('/shop?category=') || shelf.href.startsWith('/shop'), shelf.href);
    const joined = ['', ...entry.sections.map(section => section.text)].join(' ').toLowerCase();
    assert.match(joined, /18|eighteen/, entry.slug + ' must carry the 18+ alcohol rule');
    assert.match(joined, /not guaranteed|never guaranteed/, entry.slug + ' must not promise delivery');
    assert.match(joined, /not included|arrange/, entry.slug + ' must say what the order excludes');
  }
});

test('house party calculator maps guests, hours and shares onto rounded bottle counts', () => {
  const { housePartyCalcConfig } = load('components/Occasions/house-parties/config.ts');
  const calc = load('components/Occasions/planning/GuestDrinkCalculator.tsx');
  const html = renderToStaticMarkup(React.createElement(calc.default, { config: housePartyCalcConfig, onUse: () => {} }));
  // defaults: 60 guests, 4 hours.
  // beers: 42 served × 5 drinks = 210 ÷ 1 → 210 → case rounding of 24 → 216.
  assert.match(html, /216 bottles/);
  // spirits: 24 served × 4 = 96 ÷ 23 → 5.
  assert.match(html, /5 bottles/);
  // wine: 18 served × 3.5 = 63 ÷ 5 → 13.
  assert.match(html, /13 bottles/);
  // water & mixers: 60 × 5 = 300 ÷ 3 = 100 → case rounding of 24 → 120.
  assert.match(html, /120 bottles/);
});

test('cocktail tool resolves recipe ingredient quantities deterministically', () => {
  const { COCKTAIL_RECIPES, cocktailRequirements, clampedServings, MAX_SERVINGS } = load('components/Occasions/house-parties/cocktailPlan.ts');
  assert.ok(COCKTAIL_RECIPES.length >= 2 && COCKTAIL_RECIPES.length <= 3);
  for (const recipe of COCKTAIL_RECIPES) assert.match(recipe.note, /separately|arranged/, recipe.id + ' must remind about excluded extras');
  const gin = cocktailRequirements('gin-tonic', 12);
  assert.equal(gin.recipe.name, 'Gin & tonic');
  assert.deepEqual(gin.lines.map(line => [line.name, line.bottles]), [['Gin for cocktails', 1], ['Tonic or soda water', 2]]);
  assert.deepEqual(gin.choices, [{ name: 'Gin for cocktails', suggestedQuantity: 1 }, { name: 'Tonic or soda water', suggestedQuantity: 2 }]);
  const chapman = cocktailRequirements('chapman', 20);
  assert.deepEqual(chapman.lines.map(line => [line.name, line.bottles]), [['Blackcurrant cordial', 1], ['Lemon-lime soft drinks', 6], ['Angostura bitters', 1]]);
  assert.deepEqual(cocktailRequirements('missing-recipe', 12), { recipe: undefined, servings: 0, lines: [], choices: [] });
  assert.equal(cocktailRequirements('gin-tonic', 0).lines.length, 0);
  assert.equal(clampedServings(MAX_SERVINGS + 1), 0);
  assert.equal(clampedServings(MAX_SERVINGS), MAX_SERVINGS);
});

test('house party planning body renders tools and sections without heading, nav or money strings', () => {
  const { occasionPages, getOccasionPage } = load('lib/commercialPages.ts');
  assert.ok(getOccasionPage('house-parties'));
  const body = load('components/Occasions/house-parties/HousePartiesPlanning.tsx');
  const page = occasionPages.find(entry => entry.slug === 'house-parties');
  const html = renderToStaticMarkup(React.createElement(body.default, { page }));
  // Content between hero and request form only.
  assert.doesNotMatch(html, /<h1[ >]/);
  assert.doesNotMatch(html, /CommercialGuide|OccasionChatPlanner/i);
  assert.match(html, /House party drink calculator/);
  assert.match(html, /Cocktail plan for two or three drinks/);
  assert.match(html, /Planning summary/);
  for (const heading of ['Serve a short menu instead of a full bar', 'What the order does and does not include', 'Order with time to receive it']) assert.ok(html.includes(heading), heading);
  assert.match(html, /Gin for the cocktail table/);
  assert.match(html, /Beer for the cooler/);
  assert.match(html, /18 and over/);
  assert.match(html, /Planning suggestions only|planning estimates only/);
  // No customer-facing money strings anywhere in the planning output.
  // (Shared OccasionShelf copy mentions "prices are confirmed on each bottle page" —
  // an in-shop disclaimer, not planning math, so that fixed line is excluded.)
  const planningOnly = html.replace(/Availability and prices are confirmed[^.]*/g, '');
  assert.doesNotMatch(planningOnly, /₦/);
  assert.doesNotMatch(planningOnly, /naira/i);
  assert.doesNotMatch(planningOnly, /price/i);
});

test('planning tools collect quantities locally and only browse the catalogue by GET', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/occasions/house-parties' });
  const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  // Allow the real catalogue read (GET /api/products/search) from the shelves,
  // but never resolve it, and fail loudly on any other request — planning
  // tools must not send anything anywhere.
  let otherRequests = 0;
  global.fetch = (url, options = {}) => {
    if (String(url).includes('/api/products/search') && (!options.method || options.method === 'GET')) return new Promise(() => {});
    otherRequests++;
    return Promise.reject(new Error('Planning tools must not send data'));
  };
  const { createRoot } = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const Tools = load('components/Occasions/house-parties/HousePartyTools.tsx');
  try {
    await React.act(async () => root.render(React.createElement(Tools.default)));
    const addAll = [...document.querySelectorAll('button')].find(button => button.textContent === 'Add all suggestions to your list');
    assert.ok(addAll && !addAll.disabled, 'calculator add-all button should be active with default numbers');
    await React.act(async () => addAll.click());
    const summary = document.body.textContent;
    assert.match(summary, /216 bottles — Beer \(cans\)/);
    assert.match(summary, /120 bottles — Water & soft drinks \(75cl\)/);
    assert.match(summary, /suggestions saved to your planning summary/);
    // Shared-layer OccasionShelf copy states "prices are confirmed on each bottle page or by support" —
    // that is an in-shop disclaimer, not planning output, so it is excluded here.
    const planningOnly = summary.replace(/Availability and prices are confirmed[^.]*/g, '').replace(/prices[^.]*/g, '');
    assert.doesNotMatch(planningOnly, /₦|naira|price/i);
    assert.equal(otherRequests, 0);
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    Object.assign(global, prior);
  }
});
