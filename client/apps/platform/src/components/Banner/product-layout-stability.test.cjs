const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let probe = { perk: null, loading: true };
function load(file) {
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = name => {
    if (name === '@/lib/gtag') return { gtagEvent: () => {} };
    if (name === '@/context/FirstOrderPerkContext') return { useFirstOrderPerk: () => probe };
    if (name === 'commerce-core') return load(path.resolve(__dirname, '../../../../../packages/commerce-core/src/first-order-perk.ts'));
    if (name === './banner-link') return { BannerClickLayer: () => null, BannerClickArea: ({children}) => children, isImageClickable: () => false };
    return require(name);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return fixture.exports;
}
test('product-page promotion is present in server HTML instead of inserted after hydration', () => {
  const Banner = load(__dirname + '/PlacementBanner.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Banner, {
    placement: 'product_page', initialBannersComplete: true,
    initialBanners: [{ _id: 'ad', title: 'Current promotion', placement: 'product_page', image: { url: 'https://example.com/promotion.jpg' } }],
  }));
  assert.match(html, /promotion.jpg/);
  assert.match(html, /aspect-ratio:21\/9/);
});
test('static announcement uses its server seed on the initial render', () => {
  const Banner = load(__dirname + '/AnnouncementBanner.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Banner, {
    layout: 'static', initialBannersComplete: true,
    initialBanners: [{ _id: 'ad', title: 'Current delivery announcement', type: 'announcement', placement: 'header' }],
  }));
  assert.match(html, /Current delivery announcement/);
});
test('pending first-order eligibility adds no fallback strip or empty header space', () => {
  const Banner = load(__dirname + '/FirstOrderPerkBanner.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Banner, { variant: 'bar' }));
  assert.equal(html, '');
  assert.doesNotMatch(html, /Free delivery|first order/i);
});
test('cart eligibility card remains hidden while eligibility is unknown', () => {
  const Banner = load(__dirname + '/FirstOrderPerkBanner.tsx').default;
  assert.equal(renderToStaticMarkup(React.createElement(Banner, { variant: 'card' })), '');
});
test('eligible offers remain dismissible and hidden states leave no replacement strip', async () => {
  const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const previous = { window: global.window, document: global.document, localStorage: global.localStorage };
  Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  const { createRoot } = require('react-dom/client');
  const Banner = load(__dirname + '/FirstOrderPerkBanner.tsx').default;
  const root = createRoot(document.getElementById('root'));
  const render = () => root.render(React.createElement(Banner, { variant: 'bar' }));
  try {
    probe = { loading: false, perk: { eligible: true, reason: 'ok', minSubtotal: 50000, maxWaiver: 5000, waivedAmount: 5000, payableFee: 0 } };
    await React.act(async () => render());
    assert.match(document.body.textContent, /Your first delivery is on us/);
    await React.act(async () => document.querySelector('button[aria-label="Dismiss offer"]').click());
    assert.equal(document.getElementById('root').innerHTML, '');
    assert.equal(localStorage.getItem('dh_first_order_perk_dismissed'), '1');
    await React.act(async () => root.unmount());
    localStorage.clear();
    const hiddenRoot = createRoot(document.getElementById('root'));
    probe = { loading: false, perk: { ...probe.perk, eligible: false, reason: 'already_purchased' } };
    try {
      await React.act(async () => hiddenRoot.render(React.createElement(Banner, { variant: 'bar' })));
      assert.equal(document.getElementById('root').innerHTML, '');
    } finally { await React.act(async () => hiddenRoot.unmount()); }
  } finally {
    probe = { perk: null, loading: true };
    dom.window.close(); Object.assign(global, previous);
  }
});
