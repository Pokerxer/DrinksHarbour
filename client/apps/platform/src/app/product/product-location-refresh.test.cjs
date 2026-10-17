const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react'), { createRoot } = require('react-dom/client');
const adminRequire = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'));
const { JSDOM } = adminRequire('jsdom');
test('location refresh keeps the detail mounted so an explicit seller choice survives', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const before = { window: global.window, document: global.document, fetch: global.fetch };
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  let shopping = { location: null, revision: '' }, mounts = 0, unmounts = 0, finish, calls = 0, detailProps;
  global.fetch = () => new Promise(resolve => { calls++; finish = resolve; });
  const Empty = () => null;
  function Detail(props) { detailProps = props; React.useEffect(() => { mounts++; return () => { unmounts++; }; }, []); return React.createElement('div', null, 'Chosen seller'); }
  const file = path.join(__dirname, '[slug]/ProductClient.tsx'), fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = name => {
    if (name === '@/context/ShoppingLocationContext') return { useShoppingLocation: () => shopping };
    if (name === '@/lib/shoppingRequest') return { shoppingHeaders: () => new Headers() };
    if (name === '@/lib/gtag') return { viewItemEvent: () => {} };
    if (name === '@/components/Product/Detail') return { __esModule: true, default: Detail };
    if (name === '@/components/Banner') return { AnnouncementBanner: Empty, PlacementBanner: Empty };
    if (name === 'next/dynamic') return { __esModule: true, default: () => Empty };
    if (name.startsWith('@/components/')) return { __esModule: true, default: Empty };
    return require(name);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  const Client = fixture.exports.default, root = createRoot(dom.window.document.getElementById('root'));
  const product = { _id: 'p', name: 'Test', slug: 'test', availableAt: [] };
  const related = [{ id: 'related' }];
  const render = () => root.render(React.createElement(Client, { slug: 'test', initialProduct: product, initialRelated: related }));
  try {
    await React.act(async () => render());
    assert.equal(mounts, 1);
    shopping = { location: { lat: 0, lon: 0 }, revision: '0:0' };
    await React.act(async () => render());
    assert.equal(unmounts, 0, 'background refresh must retain seller-selection state');
    await React.act(async () => finish({ ok: false, status: 503 }));
    const retry = [...document.querySelectorAll('button')].find(button => /retry|try again/i.test(button.textContent));
    assert.ok(retry, 'background refresh failure has an actionable retry');
    assert.equal(detailProps.purchaseBlocked, true);
    await React.act(async () => retry.click());
    await React.act(async () => finish({ ok: true, json: async () => ({ success: true, data: { product, relatedProducts: related } }) }));
    assert.equal(mounts, 1);
    assert.equal(detailProps.purchaseBlocked, false);
    const count = calls;
    shopping = { location: null, revision: '' };
    await React.act(async () => render());
    assert.equal(calls, count + 1, 'clearing the location must refresh live stock rather than reuse the initial payload');
    await React.act(async () => finish({ ok: true, json: async () => ({ success: true, data: { product, relatedProducts: related } }) }));
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close(); global.window = before.window; global.document = before.document; global.fetch = before.fetch;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
