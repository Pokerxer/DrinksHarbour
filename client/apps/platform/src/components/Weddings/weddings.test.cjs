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
      if (/\.module\.css$/.test(request)) return {}; // CSS modules: class-name maps are not needed in tests
      if (request === 'next/navigation') return { notFound() { throw new Error('NOT_FOUND'); } };
      if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        const file = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(match => fs.existsSync(match) && fs.statSync(match).isFile());
        return read(file || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

test('wedding route renders a dedicated shortlist, useful guide links and its existing SEO identity', async () => {
  const route = load('app/occasions/[occasion]/page.tsx');
  const props = { params: Promise.resolve({ occasion: 'weddings' }) };
  const html = renderToStaticMarkup(await route.default(props));
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('h1').length, 1);
  assert.equal(dom.window.document.querySelectorAll('input[type="checkbox"]').length, 6);
  for (const href of ['/occasions', '/shop?category=wine', '/shop?category=champagne', '/shop?category=non-alcoholic', '/bulk-drinks', '/shipping-info', '/contact']) assert(html.includes(`href="${href}"`), href);
  assert.match(html, /Separate the toast from the meal/);
  assert.match(html, /href="https:\/\/wa.me\//);
  const meta = await route.generateMetadata(props);
  assert(String(meta.alternates.canonical).endsWith('/occasions/weddings'));
  const schemas = [...html.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
  assert(schemas.some(schema=>schema['@type']==='BreadcrumbList'));
  await assert.rejects(()=>route.default({params:Promise.resolve({occasion:'unknown'})}), /NOT_FOUND/);
  dom.window.close();
});

test('catalogue search ignores stale responses and offers recovery after errors and empty results',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
  const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const pending=[];global.fetch=(url,options)=>new Promise((resolve,reject)=>pending.push({url,options,resolve,reject}));
  const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
  const Search=load('components/Weddings/CatalogueBottleSearch.tsx').default;
  async function search(value){await React.act(async()=>{const el=document.getElementById('wedding-bottle-search');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));}
  const response=name=>({ok:true,json:async()=>({success:true,data:{products:name?[{_id:name,name,slug:name.toLowerCase()}]:[]}})});
  try{
    await React.act(async()=>root.render(React.createElement(Search,{onAdd:()=>{}})));
    await search('Old');await search('New');assert.equal(pending[0].options.signal.aborted,true);
    await React.act(async()=>pending[1].resolve(response('New')));
    assert(document.body.textContent.includes('Add New'));
    await React.act(async()=>pending[0].resolve(response('Old')));
    assert(!document.body.textContent.includes('Add Old'));
    await search('Failed');await React.act(async()=>pending[2].reject(new Error('offline')));
    assert.match(document.body.textContent,/search is unavailable/);
    await search('Empty');await React.act(async()=>pending[3].resolve(response(null)));
    assert.match(document.body.textContent,/No matches/);
  }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('a bottle query entered before hydration survives initialization and searches the live form value',async()=>{
  const Search=load('components/Weddings/CatalogueBottleSearch.tsx').default;
  const markup=renderToStaticMarkup(React.createElement(Search,{onAdd:()=>{}}));
  const dom=new JSDOM(`<div id="root">${markup}</div>`,{url:'http://localhost/occasions/weddings'});
  const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const calls=[];global.fetch=async url=>{calls.push(String(url));return {ok:true,json:async()=>({success:true,data:{products:[]}})};};
  document.getElementById('wedding-bottle-search').value='Glenfiddich';
  const {hydrateRoot}=require('react-dom/client');let root;
  try{
    await React.act(async()=>{root=hydrateRoot(document.getElementById('root'),React.createElement(Search,{onAdd:()=>{}}));});
    assert.equal(document.getElementById('wedding-bottle-search').value,'Glenfiddich','hydration must not wipe an already typed bottle query');
    await React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
    assert.equal(calls.length,1);
    assert.equal(new URL(calls[0],'http://localhost').searchParams.get('q'),'Glenfiddich');
  }finally{if(root)await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('catalogue suggestions appear while typing and keyboard selection adds a bottle without submitting a search',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const calls=[],picked=[];global.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({success:true,data:{products:[{_id:'juice',name:'Apple Juice',slug:'apple-juice',images:[{url:'https://res.cloudinary.com/demo/image/upload/v123/juice.jpg'}]}]}})};};
 const Search=load('components/Weddings/CatalogueBottleSearch.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const type=async text=>React.act(async()=>{const input=document.getElementById('wedding-bottle-search');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,text);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 try{
  await React.act(async()=>root.render(React.createElement(Search,{onAdd:bottle=>{picked.push(bottle);return true;}})));
  await type('Ap');await type('Apple');assert.equal(calls.length,0,'typing is debounced');
  await React.act(async()=>new Promise(resolve=>setTimeout(resolve,320)));
  assert.equal(calls.length,1);assert.equal(new URL(calls[0],'http://localhost').searchParams.get('q'),'Apple');
  const image=document.querySelector('#wedding-bottle-options img');assert(image,'suggestions show product images');assert.match(image.getAttribute('src'),/juice.jpg/);
  await React.act(async()=>image.dispatchEvent(new dom.window.Event('error')));
  assert(document.querySelector('[data-thumbnail-fallback]'),'broken images retain a stable placeholder');
  const input=document.getElementById('wedding-bottle-search');assert.equal(input.getAttribute('aria-expanded'),'true');
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})));
  await React.act(async()=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  assert.equal(picked[0].productId,'juice');assert.equal(input.value,'');assert.equal(calls.length,1);
  await type('Again');await type('');await React.act(async()=>new Promise(resolve=>setTimeout(resolve,320)));assert.equal(calls.length,1,'clear cancels pending search');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('catalogue search uses light public matching, keeps late results closed after blur and reuses current-session results',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const pending=[];global.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const Search=load('components/Weddings/CatalogueBottleSearch.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 async function search(){await React.act(async()=>{const input=document.getElementById('wedding-bottle-search');input.focus();Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'Apple');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});}
 try{
  await React.act(async()=>root.render(React.createElement(Search,{onAdd(){return true;}})));
  await search();
  const params=new URL(pending[0].url,'http://localhost').searchParams;
  assert.equal(params.get('fields'),'card');assert.equal(params.get('searchMode'),'text');
  await React.act(async()=>document.getElementById('wedding-bottle-search').blur());
  await React.act(async()=>pending[0].resolve({ok:true,json:async()=>({success:true,data:{products:[{_id:'juice',name:'Apple Juice',slug:'apple-juice'}]}})}));
  assert.equal(document.querySelector('[role=listbox]'),null,'a late request must not reopen a blurred search');
  await React.act(async()=>document.getElementById('wedding-bottle-search').focus());
  assert(document.querySelector('[role=listbox]'));
  await search();assert.equal(pending.length,1,'identical recent query should not repeat a network request');
  assert(document.querySelector('[role=option]'));
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('a stalled catalogue request times out with an enabled retry and retains the search term',async t=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let signal;global.fetch=(url,options)=>new Promise((resolve,reject)=>{signal=options.signal;signal.addEventListener('abort',()=>reject(new Error('aborted')));});
 const Search=load('components/Weddings/CatalogueBottleSearch.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  await React.act(async()=>root.render(React.createElement(Search,{onAdd(){}})));
  await React.act(async()=>{const input=document.getElementById('wedding-bottle-search');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'Chivita');document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  await React.act(async()=>t.mock.timers.tick(12001));
  assert.equal(signal.aborted,true);assert.match(document.body.textContent,/took too long/);
  const retry=[...document.querySelectorAll('button')].find(button=>button.textContent==='Try search again');
  assert(retry);assert.equal(retry.disabled,false);assert.equal(document.getElementById('wedding-bottle-search').value,'Chivita');
 }finally{await React.act(async()=>root.unmount());t.mock.timers.reset();dom.window.close();Object.assign(global,prior);}
});
