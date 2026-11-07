const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
const file = path.join(__dirname, 'PackPricingCard.tsx');
const fixture = new Module(file, module);
fixture.paths = module.paths;
fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const Card = fixture.exports.default;
const offer = {
  currencySymbol: '₦', sizeLabel: '70cl', packUnitPrice: 111100,
  packThreshold: 6, packSavingsPct: 3, normalPrice: 115100,
  quantity: 1, packRateActive: false, packThresholdRemaining: 5,
};
test('bulk comparison identifies the selected size, pack total and actual savings', () => {
  const dom = new JSDOM(renderToStaticMarkup(React.createElement(Card, offer)));
  const text = dom.window.document.body.textContent;
  assert.match(text, /70cl/);
  assert.match(text, /Single-unit price/);
  assert.match(text, /Pack total.*₦666,600/);
  assert.match(text, /Save ₦24,000/);
  assert.doesNotMatch(text, /\bWas\b/);
  dom.window.close();
});
test('bulk action explicitly selects a quantity and does not imply adding to cart', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
  const previous = {window: global.window, document: global.document};
  Object.assign(global, {window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true});
  const {createRoot} = require('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  let selected = 0;
  try {
    await React.act(async () => root.render(React.createElement(Card, {...offer, onQuickAddPack: () => selected++})));
    const button = document.querySelector('button');
    assert.equal(button.textContent.trim(), 'Select 6 units');
    await React.act(async () => button.click());
    assert.equal(selected, 1);
    await React.act(async () => root.render(React.createElement(Card, offer)));
    assert.equal(document.querySelector('button'), null, 'no inert quantity-selection action without a handler');
  } finally {
    await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, previous);
  }
});
