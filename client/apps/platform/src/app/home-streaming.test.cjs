const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToPipeableStream } = require('react-dom/server');
const { PassThrough } = require('node:stream');

test('homepage sends hero while catalog is pending, then sends server catalog', async () => {
  let ready = false;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const content = () => {
    if (!ready) throw pending;
    return React.createElement('a', { href: '/product/test-bottle' }, 'Server catalog');
  };
  const mocks = {
    './home-seo': { homeMetadata: {} },
    'next/dynamic': { default: () => () => null },
    '@/components/UI/LazySection': { default: () => null },
    '@/components/Shop/recommendations': { fetchInitialRecommendations: async () => [] },
    '@/lib/product-jsonld': { buildProductItemList: () => null },
    '@/lib/jsonld': { jsonLdHtml: JSON.stringify },
    '@/components/Home1/MarketplaceIntro': { default: () => null },
    '@/components/Home1/HomeCategoryDrawer': { default: () => null },
    '@/components/Home1/HomeFlashSale': { default: () => { if (!ready) throw pending; return null; } },
    '@/components/Home1/HomeSections': { default: content },
    '@/components/Banner/HomeHero': { default: () => React.createElement('div', null, 'Immediate hero') },
  };
  const page = new Module(__filename + '.fixture', module);
  page.filename = __filename;
  page.paths = module.paths;
  page.require = request => (mocks[request] ? { __esModule: true, ...mocks[request] } : require(request));
  const source = ts.transpileModule(fs.readFileSync(__dirname + '/page.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  page._compile(source, __filename);
  const element = page.exports.default();
  assert.equal(typeof element?.then, 'undefined', 'home shell must not await catalog requests');
  const output = new PassThrough();
  let html = '';
  output.on('data', chunk => { html += chunk; });
  const complete = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  const stream = renderToPipeableStream(element, {
    onShellReady() { stream.pipe(output); },
    onError(error) { output.destroy(error); },
  });
  try {
    await new Promise(resolve => setImmediate(resolve));
    assert.match(html, /Immediate hero/);
    assert.match(html, /Loading current offers/);
    assert.doesNotMatch(html, /Server catalog/);
    ready = true;
    release();
    await complete;
    assert.match(html, /href="\/product\/test-bottle"/);
  } finally { stream.abort(); }
});
