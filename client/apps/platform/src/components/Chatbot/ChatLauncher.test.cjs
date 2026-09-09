const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Compile local TS/TSX without adding a test framework to the storefront.
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

test('closed launcher offers Ask AI without automatically rendering the invitation', () => {
  const Launcher = require('./ChatLauncher.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Launcher, { isOpen: false, unread: 0, onToggle() {} }));
  assert.match(html, /Ask AI/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Need help choosing a drink/);
});

test('open launcher exposes close control, not unread notification', () => {
  const Launcher = require('./ChatLauncher.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Launcher, { isOpen: true, unread: 2, onToggle() {} }));
  assert.match(html, /Close chat/);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /unread messages/);
});

test('closed launcher announces unread messages', () => {
  const Launcher = require('./ChatLauncher.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Launcher, { isOpen: false, unread: 2, onToggle() {} }));
  assert.match(html, /2 unread messages/);
});

test('floating AI control is visible on mobile outside navigation', () => {
  const Launcher = require('./ChatLauncher.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Launcher, { isOpen: false, unread: 0, onToggle() {} }));
  assert.match(html, /<button[^>]*class="[^"]*relative flex/);
  assert.doesNotMatch(html, /<button[^>]*class="[^"]*hidden/);
});

test('WhatsApp nav link keeps the configured destination and safe external navigation', () => {
  const WhatsAppNavLink = require('../Navigation/WhatsAppNavLink.tsx').default;
  const { WHATSAPP_URL } = require('../WhatsApp/whatsappLink.ts');
  const html = renderToStaticMarkup(React.createElement(WhatsAppNavLink));
  assert.ok(html.includes(`href="${WHATSAPP_URL}"`));
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /WhatsApp/);
  assert.match(html, /min-h-11/);
});

test('floating WhatsApp sits at the left on mobile, away from Ask AI', () => {
  const WhatsAppButton = require('../WhatsApp/WhatsAppButton.tsx').default;
  const html = renderToStaticMarkup(React.createElement(WhatsAppButton));
  assert.match(html, /^<div class="[^"]*left-4/);
  assert.doesNotMatch(html, /^<div class="[^"]*hidden/);
  assert.match(html, /safe-area-inset-bottom/);
});

test('WhatsApp stacks above card tooltips but below share and cart dialogs', () => {
  const WhatsAppButton = require('../WhatsApp/WhatsAppButton.tsx').default;
  const html = renderToStaticMarkup(React.createElement(WhatsAppButton));
  const layer = Number(html.match(/^<div class="[^"]*z-\[(\d+)\]/)?.[1]);
  assert.ok(layer > 50, 'must clear product card tooltip layer 50');
  assert.ok(layer < 60, 'must stay below dialog backdrop layer 60');
});

test('mobile navigation has four shopping tabs and no chat entries or chat timers', () => {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../Navigation/MobileBottomNav.tsx'), 'utf8');
  assert.match(source, /grid-cols-4/);
  assert.doesNotMatch(source, /WhatsAppNavLink|mobile-chat-toggle|chatAttention|chat-widget-state|id: "chatbot"/);
});
