const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = Module.createRequire(path.resolve(__dirname, '../../../../admin/package.json'))('jsdom');
const sourceRoot = path.resolve(__dirname, '../..');

function load(relative, mocks = {}) {
  const cache = new Map();
  function read(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const m = new Module(filename, module); m.paths = module.paths; cache.set(filename, m);
    m.require = request => {
      if (request in mocks) return mocks[request];
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (request === 'next/navigation') return { notFound() { throw new Error('NOT_FOUND'); } };
      if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
      if (request.startsWith('@/') || request.startsWith('.')) {
        const base = request.startsWith('@/') ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(filename), request);
        return read([base, base + '.ts', base + '.tsx'].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || base);
      }
      return require(request);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
    return m.exports;
  }
  return read(path.join(sourceRoot, relative));
}

test('clearing an inline AI request aborts it and ignores a late reply',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let pending;global.fetch=(url,options)=>new Promise(resolve=>{pending={resolve,signal:options.signal};});
 const Help=load('components/Weddings/WeddingChatHelp.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
 try{
  await React.act(async()=>root.render(React.createElement(Help,{items:[],interests:''})));
  await React.act(async()=>button('Review my list').click());assert(pending);
  assert.match(document.body.textContent,/AI is reviewing/);
  await React.act(async()=>button('Clear AI conversation').click());assert.equal(pending.signal.aborted,true);
  await React.act(async()=>pending.resolve({ok:true,status:200,json:async()=>({success:true,data:{response:'STALE REPLY'}})}));
  assert(!document.body.textContent.includes('STALE REPLY'));
  assert.equal(button('Review my list').disabled,false);
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});
test('inline AI exposes network recovery and renders untrusted markdown without raw HTML or script links',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let calls=0;global.fetch=async()=>{if(++calls===1)throw new Error('offline');return {ok:true,status:200,json:async()=>({success:true,data:{response:'**Venue checklist**\n\n<img src=x onerror=alert(1)>\n\n[Bad link](javascript:alert(1))'}})};};
 const Help=load('components/Weddings/WeddingChatHelp.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
 try{
  await React.act(async()=>root.render(React.createElement(Help,{items:[],interests:''})));
  await React.act(async()=>button('Review my list').click());assert.match(document.body.textContent,/Could not reach/);
  await React.act(async()=>button('Try AI again').click());assert.equal(calls,2);
  const transcript=document.querySelector('[aria-label="Wedding AI conversation"]');assert(transcript.querySelector('strong'));
  assert.equal(transcript.querySelector('img'),null);
  assert([...transcript.querySelectorAll('a')].every(link=>!String(link.getAttribute('href')).startsWith('javascript:')));
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('occasion chat sends file-only messages, remembers extracted context and preserves a failed draft for retry',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const calls=[];let fail=true;
 global.fetch=async(url,options)=>{calls.push(options.body);if(fail)throw Error('offline');return {ok:true,status:200,json:async()=>({success:true,data:{response:'You asked for 12 Apple Juice. What is the date?',attachmentContext:'Uploaded list: 12 Apple Juice'}})};};
 const Chat=load('components/Occasions/OccasionChat.tsx').default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
 async function type(text){const el=document.getElementById('wedding-ai-question');await React.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
 try{
  await React.act(async()=>root.render(React.createElement(Chat,{occasion:'corporate',items:[],interests:''})));
  assert.equal(calls.length,0);
  const upload=document.querySelector('input[type=file]');assert(upload,'customer can attach a list');
  Object.defineProperty(upload,'files',{value:[new File(['12 Apple Juice'],'reception.csv',{type:'text/csv'})],configurable:true});
  await React.act(async()=>upload.dispatchEvent(new dom.window.Event('change',{bubbles:true})));
  assert.match(document.body.textContent,/reception.csv/);assert.equal(button('Send to AI').disabled,false);
  await React.act(async()=>button('Send to AI').click());assert.equal(calls.length,1);
  assert.equal(calls[0].get('file').name,'reception.csv');assert.equal(calls[0].get('occasion'),'corporate');
  assert.match(document.body.textContent,/Could not reach/);assert.match(document.body.textContent,/reception.csv/);
  fail=false;await React.act(async()=>button('Try AI again').click());
  assert.equal(calls[1].get('file').name,'reception.csv','retry retains the original attachment');
  assert.match(document.querySelector('[role=log]').textContent,/reception.csv/);
  await type('Saturday, alcohol-free only');fail=true;
  await React.act(async()=>button('Send to AI').click());assert.equal(document.getElementById('wedding-ai-question').value,'Saturday, alcohol-free only');
  fail=false;await React.act(async()=>button('Try AI again').click());
  assert.match(calls.at(-1).get('conversationHistory'),/Uploaded list: 12 Apple Juice/);
  assert.match(calls.at(-1).get('query'),/Saturday, alcohol-free only/);
  assert.equal(document.getElementById('wedding-ai-question').value,'');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});


test('changing storefront cancels AI work and clears the previous conversation and unsent draft',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const pending=[];global.fetch=(url,options)=>new Promise(resolve=>pending.push({resolve,options}));
 const tenantModule=load('context/TenantContext.tsx');
 const Chat=load('components/Occasions/OccasionChat.tsx',{'@/context/TenantContext':tenantModule}).default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
 const render=tenant=>React.createElement(tenantModule.TenantProvider,{initialTenant:{_id:tenant,name:tenant,slug:tenant}},React.createElement(Chat,{occasion:'weddings'}));
 try{
  await React.act(async()=>root.render(render('shop-a')));
  await React.act(async()=>{const input=document.getElementById('wedding-ai-question');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Draft for shop A');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  await React.act(async()=>button('Review my list').click());assert.equal(pending[0].options.body.get('tenantId'),'shop-a');
  await React.act(async()=>root.render(render('shop-b')));
  assert.equal(pending[0].options.signal.aborted,true);
  assert.equal(document.getElementById('wedding-ai-question').value,'');
  await React.act(async()=>pending[0].resolve({ok:true,status:200,json:async()=>({success:true,data:{response:'SHOP A PRIVATE PLAN'}})}));
  assert(!document.body.textContent.includes('SHOP A PRIVATE PLAN'));
  await React.act(async()=>button('Review my list').click());
  assert.equal(pending[1].options.body.get('tenantId'),'shop-b');
  assert(!pending[1].options.body.get('conversationHistory').includes('Draft for shop A'));
 }finally{await React.act(async()=>{root.unmount();for(const request of pending)request.resolve({ok:true,status:200,json:async()=>({success:true,data:{response:'Finished'}})});});dom.window.close();Object.assign(global,prior);}
});

test('a catalogue slug in an AI reply opens the actual product route',()=>{
 const Transcript=load('components/Weddings/WeddingAiTranscript.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Transcript,{messages:[{role:'assistant',content:'[Read juice details](apple-juice)',products:[{productId:'juice',name:'Apple Juice',slug:'apple-juice'}]}],loading:false,error:null,onRetry(){}}));
 assert.match(html,/href="\/product\/apple-juice"[^>]*>Read juice details<\/a>/);
});
