const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { createRoot } = require('react-dom/client');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../admin/package.json'))('jsdom');

test('typing and clearing discard older search and suggestion completions; pagination errors remain retryable', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const previous = { window: global.window, document: global.document, localStorage: global.localStorage, fetch: global.fetch };
  Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  const requests = [];
  global.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  let location = null;
  function load(file) {
  const fixture = new Module(file, module); fixture.paths = module.paths;
  fixture.require = name => {
    if (name === '@/context/ShoppingLocationContext') return { useShoppingLocation: () => ({ location, revision: location ? `${location.lat}:${location.lon}` : '' }) };
    if (name === '@/lib/shoppingRequest') return { shoppingHeaders: () => ({}) };
    if (name === '@/lib/gtag') return { gtagEvent() {} };
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file), name);
      return load([base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file)));
    }
    return require(name);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, file);
  return fixture.exports;
  }
  const { ModalSearchProvider, useModalSearchContext } = load(path.join(__dirname, 'ModalSearchContext.tsx'));
  let value;
  function Probe() { value = useModalSearchContext(); return null; }
  const root = createRoot(document.getElementById('root'));
  const render = () => root.render(React.createElement(ModalSearchProvider, null, React.createElement(Probe)));
  const reply = products => ({ ok: true, json: async () => ({ success: true, data: { products, pagination: { totalResults: 16, currentPage: 1, totalPages: 2 } } }) });
  const wait = () => new Promise(resolve => setTimeout(resolve, 280));
  try {
    await React.act(async () => render());
    let pending;
    await React.act(async () => { value.setSearchQuery('wine'); pending = value.performSearch('wine'); });
    await React.act(async () => value.setSearchQuery('beer'));
    await React.act(async () => { requests.shift().resolve(reply([{ _id: 'stale' }])); await pending; });
    assert.equal(value.searchResults, null, 'old query cannot publish while the new query is debouncing');
    await React.act(async () => { value.fetchSuggestions('wine'); await wait(); });
    const oldSuggestion = requests.shift();
    await React.act(async () => value.fetchSuggestions(''));
    await React.act(async () => oldSuggestion.resolve({ ok: true, json: async () => ({ success: true, data: ['Old wine'] }) }));
    assert.deepEqual(value.suggestions, []);
    assert.equal(value.isLoadingSuggestions, false);
    await React.act(async () => { pending = value.performSearch('beer'); });
    await React.act(async () => { requests.shift().resolve(reply([{ _id: 'beer' }])); await pending; });
    await React.act(async () => { pending = value.loadMoreResults(); });
    await React.act(async () => { requests.shift().resolve({ ok: false, status: 503 }); await pending; });
    assert.ok(value.searchError, 'pagination failure must be visible');
    assert.equal(value.searchResults.products[0]._id, 'beer');
    await React.act(async () => { pending = value.loadMoreResults(); });
    await React.act(async () => { requests.shift().resolve(reply([{ _id: 'second-page' }])); await pending; });
    assert.equal(value.searchError, null);
    assert.equal(value.searchResults.products.length, 2);
    location = { lat: 9, lon: 7, source: 'delivery', label: 'Abuja' };
    await React.act(async () => render());
    await React.act(async () => { pending = value.performSearch('beer'); });
    const oldLocation = requests.shift();
    location = { ...location, lat: 8 };
    await React.act(async () => render());
    await React.act(async () => { oldLocation.resolve(reply([{ _id: 'old-location' }])); await pending; });
    assert.equal(value.searchResults, null, 'changing location discards the previous location request');
    await React.act(async () => value.clearSearch());
    assert.equal(value.searchResults, null);
  } finally {
    await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, previous);
  }
});
