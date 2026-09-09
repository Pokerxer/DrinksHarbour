// Read-only audit: run from platform with node --env-file=.env --env-file=.env.local.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file) {
  const filename = path.resolve(file);
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = compiled.require.bind(compiled);
  // Supply main-marketplace request headers outside the Next request runtime.
  compiled.require = (id) => id === 'next/headers'
    ? { headers: async () => new Headers() }
    : originalRequire(id);
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return compiled.exports;
}

(async () => {
  const page = load('src/app/catalogue/page.tsx').default;
  const directory = load('src/components/Stores/StoreDirectoryLinks.tsx').default;
  const [catalogue, stores] = await Promise.all([page(), directory()]);
  const html = renderToStaticMarkup(catalogue) + renderToStaticMarkup(stores);
  const urls = fs.readFileSync('../../../docs/seo-orphan-inventory.md', 'utf8')
    .match(/https:\/\/[^\s]+/g).filter(url => !url.endsWith('/vip-signup'));
  const missing = urls.filter(url => !html.includes(`href="${new URL(url).pathname}"`));
  if (missing.length) throw new Error(`Missing rendered links: ${missing.join(', ')}`);
  console.log(`Verified ${urls.length} orphan product/store links in server-rendered HTML.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
