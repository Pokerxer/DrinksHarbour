const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const names = ['Cart', 'Wishlist', 'Search', 'Quickview', 'Compare'];
function render(open = '') {
  let childIndex = 0;
  const file = __dirname + '/CommerceModals.tsx';
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = request => {
    if (request === 'next/dynamic') return { __esModule: true, default: () => {
      const name = names[childIndex++];
      return () => React.createElement('aside', { role: 'dialog', 'aria-label': name }, name);
    } };
    for (const name of names) {
      if (request === `@/context/Modal${name}${name === 'Search' ? 'UI' : ''}Context`) {
        return { [`useModal${name}${name === 'Search' ? 'UI' : ''}Context`]: () => ({ isModalOpen: open === name, isOpen: open === name }) };
      }
    }
    return require(request);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, file);
  return renderToStaticMarkup(React.createElement(fixture.exports.default));
}
test('closed shopping dialogs do not mount during the initial render', () => {
  assert.equal(render(), '');
});
for (const name of names) test(`opening ${name} mounts its dialog without the other dialogs`, () => {
  const html = render(name);
  assert.match(html, new RegExp(`aria-label="${name}"`));
  assert.equal((html.match(/role="dialog"/g) || []).length, 1);
});
