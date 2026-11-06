const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../..');

function load(relative) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { role: 'customer' } }) };
      if (request === '@/lib/fetchWithAuth') return { fetchWithAuth: (...args) => global.fetch(...args) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        return read([base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

test('occasion hub serves every guide and one main heading before client interaction', () => {
  const page = load('app/occasions/page.tsx');
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  for (const href of ['/occasions/weddings', '/occasions/corporate', '/occasions/house-parties', '/occasions/gifting', '/bulk-drinks', '/contact']) assert(html.includes(`href="${href}"`), href);
  assert.match(html, /id="occasion-planner"/);
  assert.match(html, /<noscript>/);
  assert(String(page.metadata.alternates.canonical).endsWith('/occasions'));
});

test('occasion selection focuses the staff request form without transmitting customer details',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let requests=0;global.fetch=async()=>{requests++;throw Error('No sends on selection');};
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const Explorer=load('components/Occasions/OccasionsExplorer.tsx').default;
 try{await React.act(async()=>root.render(React.createElement(Explorer)));
  await React.act(async()=>document.querySelector('button[aria-label="Plan Corporate events"]').click());
  assert.equal(document.getElementById('occasion-choice').value,'corporate');
  assert.equal(document.activeElement.id,'occasion-planner-heading');
  assert(document.body.textContent.includes('Send request to our team'));assert(!document.body.textContent.includes('Send list to AI'));
  assert.equal(requests,0);
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});
