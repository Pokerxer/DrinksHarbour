const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file) {
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = request => request === '@/components/WhatsApp/whatsappLink'
    ? load(path.join(__dirname, '../../WhatsApp/whatsappLink.ts')) : require(request);
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return fixture.exports;
}
const Button = load(path.join(__dirname, 'OrderWhatsAppButton.tsx')).default;
const base = { productName: 'Mango & Orange', size: '1L', quantity: 1,
  unitPrice: 5000, total: 5000, currencySymbol: '₦', seller: 'Example Shop' };
const render = props => renderToStaticMarkup(React.createElement(Button, { ...base, ...props }));
const message = html => new URL(html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&')).searchParams.get('text');

test('sold-out product enables a restock enquiry even when ordering is disabled', () => {
  const html = render({ outOfStock: true, disabled: true, productPath: '/product/mango-orange' });
  assert.match(html, /Ask about availability on WhatsApp/);
  const text = message(html);
  assert.match(text, /When will it be available again/);
  assert.match(text, /Mango & Orange/);
  assert.match(text, /1L/);
  assert.match(text, /Example Shop/);
  assert.match(text, /\/product\/mango-orange/);
  assert.doesNotMatch(text, /place an order|Estimated total|Unit price|Quantity/);
  assert.doesNotMatch(html, /aria-disabled/);
});
test('sold-out product without a size still has an availability enquiry', () => {
  const html = render({ outOfStock: true, disabled: true, size: '', seller: undefined });
  assert.match(html, /href="https:\/\/wa.me\//);
  assert.doesNotMatch(message(html), /• Size:|• Sold by:/);
});
test('in-stock product keeps the configured WhatsApp order details', () => {
  const html = render({ outOfStock: false });
  assert.match(html, /Order on WhatsApp/);
  assert.match(message(html), /place an order/);
  assert.match(message(html), /Estimated total: ₦5,000/);
});
test('missing size for an available product keeps the order button disabled', () => {
  const html = render({ disabled: true, outOfStock: false });
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /href=/);
});
