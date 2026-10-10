const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Module = require('node:module');

// Render the real shop, filter header, chips and hero. Isolate remote catalog
// fetching and unrelated product carousels, which are not needed for empty grids.
const originalLoad = Module._load;
Module._load = function(request, parent, ...rest) {
  if (request === 'next/navigation') return {
    useRouter: () => ({ replace() {}, push() {} }),
    usePathname: () => '/shop',
    useSearchParams: () => new URLSearchParams('category=gift-sets-hampers'),
  };
  if (request === 'commerce-core') return {
    getRootCategories: () => [], getSubcategories: () => [],
    fetchAllCategories: async () => [], fetchAllSubCategories: async () => [],
  };
  if (['./FilterSidebar', './ProductGrid', './OnSaleHighlight', './RecentlyViewed', './PaginationSection'].includes(request)) return { default: () => null, __esModule: true };
  if (request.startsWith('@/')) request = path.join(__dirname, '../..', request.slice(2));
  return originalLoad.call(this, request, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(process.env.SHOP_BASELINE && ['index.tsx', 'ShopHeroBanner.tsx'].includes(path.basename(filename)) && path.dirname(filename) === __dirname ? path.join('/tmp/shop-baseline', path.basename(filename)) : filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};

test('empty filtered shop retains filter controls, selected category and recovery action', () => {
  const Shop = require('./index.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Shop, {
    data: [], productPerPage: 24, productStyle: 'style-1', layoutCol: 4,
    onLayoutChange() {}, serverPaged: true, serverTotal: 0,
    initialFilters: { categoryType: 'gift-sets-hampers' },
  }));
  assert.match(html, /Filters/);
  assert.match(html, /Gift Sets Hampers/);
  assert.match(html, /No products match your filters/);
  assert.match(html, /Clear All Filters/);
});

test('category without artwork renders shop carousel instead of a gradient slab', () => {
  const Hero = require('./ShopHeroBanner.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Hero, {
    category: 'gift-sets-hampers', seed: { label: 'Gift Sets & Hampers' },
  }));
  assert.match(html, /Gift Sets &amp; Hampers/);
  const Carousel = require('../Banner/HeroBanner.tsx').default;
  assert.ok(html.includes(renderToStaticMarkup(React.createElement(Carousel, { placement: 'shop' }))));
  assert.doesNotMatch(html, /linear-gradient\(115deg/);
});
