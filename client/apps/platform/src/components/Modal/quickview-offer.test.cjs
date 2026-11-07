const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');

test('quick view follows selected offer volume and cannot exceed stock or buy below minimum', async () => {
  const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost'});
  const previous = {window: global.window, document: global.document};
  Object.assign(global, {window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true});
  const {createRoot} = require('react-dom/client');
  const closeQuickview = () => {};
  const size = (label, stock, min = 1) => ({_id:label, size:label, stock, minOrderQuantity:min, maxOrderQuantity:20,
    pricing:{websitePrice:115100, currencySymbol:'₦', packUnitPrice:111100, packThreshold:6}});
  const product = {id:'tequila', _id:'tequila', name:'Tequila', volumeMl:750, images:[], availableAt:[
    {_id:'offer', tenant:{_id:'seller', name:'Seller'}, sizes:[size('70cl', 2), size('1L', 8), size('50cl', 2, 3)]},
  ]};
  function load(file) {
    const fixture = new Module(file, module); fixture.paths = module.paths;
    fixture.require = request => {
      if (request === '@/context/ModalQuickviewContext') return {useModalQuickviewContext: () => ({selectedProduct:product, isOpen:true, closeQuickview})};
      if (request === '@/context/CartContext') return {useCart: () => ({addToCart: async () => {}})};
      if (request === '@/context/WishlistContext') return {useWishlist: () => ({wishlistState:{wishlistArray:[]}})};
      if (request === '@/context/CompareContext') return {useCompare: () => ({compareState:{compareArray:[]}, isInCompare: () => false, maxCompareLimit:4})};
      if (request.startsWith('@/context/Modal')) return {[`use${request.split('/').at(-1)}`]: () => ({})};
      if (request === 'next/link') return {__esModule:true, default:({children,...p}) => React.createElement('a', p, children)};
      if (request === 'commerce-core') return load(require.resolve(request));
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.resolve(__dirname, '../..', request.slice(2)) : path.resolve(path.dirname(file), request);
        return load([base, base+'.ts', base+'.tsx'].find(f => fs.existsSync(f)));
      }
      return require(request);
    };
    fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions:{module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true},
    }).outputText, file);
    return fixture.exports;
  }
  const Quickview = load(path.join(__dirname, 'ModalQuickview.tsx')).default;
  const root = createRoot(document.getElementById('root'));
  const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
  const volumeText = () => [...document.querySelectorAll('span')].find(e => e.textContent === 'Volume:')?.parentElement.textContent;
  try {
    await React.act(async () => root.render(React.createElement(Quickview)));
    assert.equal(volumeText(), 'Volume:700ml');
    const quantityBox = document.querySelector('span.flex-1.text-center').parentElement;
    for (let i=0; i<5; i++) await React.act(async () => quantityBox.querySelectorAll('button')[1].click());
    assert.equal(quantityBox.querySelector('span.flex-1.text-center').textContent, '2');
    await React.act(async () => button('1L').click());
    assert.equal(volumeText(), 'Volume:1000ml');
    await React.act(async () => button('Select 6 units').click());
    assert.equal(document.querySelector('span.flex-1.text-center').textContent, '6pack rate');
    await React.act(async () => button('70cl').click());
    assert.equal(document.querySelector('span.flex-1.text-center').textContent, '2');
    assert.equal(button('50cl').disabled, true, 'stock below the seller minimum is unavailable');
  } finally {
    await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, previous);
  }
});
