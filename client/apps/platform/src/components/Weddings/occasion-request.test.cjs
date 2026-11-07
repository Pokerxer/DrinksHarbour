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
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { role: 'customer' } }) };
      if (request === '@/lib/fetchWithAuth') return { fetchWithAuth: (...args) => global.fetch(...args) };
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

async function mount(){
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 const Planner=load('components/Weddings/WeddingPlanner.tsx').default;
 await React.act(async()=>root.render(React.createElement(Planner)));
 async function change(id,value){await React.act(async()=>{const el=document.getElementById(id),proto=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:el.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));});}
 return {dom,root,change,submit:()=>React.act(async()=>document.querySelector('#occasion-planner form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))),close:async()=>{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}};
}
test('customer submits selected categories and requirements for staff review and can leave after receipt',async()=>{
 const h=await mount();const calls=[];global.fetch=async(url,options)=>{calls.push({url,body:options.body});return {ok:true,json:async()=>({success:true,data:{reference:'DH-EVT-TEST123',dueAt:'2026-10-21T18:00:00Z',conversationId:'thread-id',channel:'email'}})};};
 try{
  assert(!document.body.textContent.includes('Send list to AI'));assert(!document.body.textContent.includes('Chat directly with AI'));
  await h.submit();assert.equal(calls.length,0);assert(document.querySelector('[role=alert]'));
  await h.change('occasion-city','Abuja');await h.change('occasion-name','Ada');await h.change('occasion-email','ada@example.test');await h.change('occasion-guests','300');await h.change('occasion-budget','5000000');await h.change('occasion-notes','Four hours, 180 adult drinkers; venue supplies water.');
  await React.act(async()=>document.getElementById('wedding-wine').click());
  await React.act(async()=>document.getElementById('occasion-consent').click());
  await h.submit();assert.equal(calls.filter(item=>item.body).length,1);const submittedCall=calls.find(item=>item.body);assert.match(submittedCall.url,/occasion-requests$/);
  const value=JSON.parse(calls[0].body.get('payload'));assert.equal(value.occasion,'weddings');assert.deepEqual(value.preferences,['wine']);assert.equal(value.budget,'5000000');assert.equal(value.consent,true);
  assert(document.body.textContent.includes('DH-EVT-TEST123'));assert(document.body.textContent.includes('You don’t need to stay on the site'));
  assert.equal(document.querySelector('#occasion-planner form'),null);
 }finally{await h.close();}
});
test('failed submission keeps contact/file requirements and retries with the same idempotency key',async()=>{
 const h=await mount();const keys=[];global.fetch=async(url,options)=>{keys.push(JSON.parse(options.body.get('payload')).submissionKey);if(keys.length===1)throw Error('Network unavailable');return {ok:true,json:async()=>({success:true,data:{reference:'DH-EVT-RETRY',dueAt:'2026-10-21T18:00:00Z',conversationId:'thread-id',channel:'whatsapp'}})};};
 try{
  await h.change('occasion-city','Lagos');await h.change('occasion-name','Ada');await h.change('occasion-channel','whatsapp');await h.change('occasion-whatsapp','08012345678');await h.change('occasion-notes','Please check wine for 80 guests.');await React.act(async()=>document.getElementById('occasion-consent').click());
  await h.submit();assert(document.querySelector('[role=alert]'));assert.equal(document.getElementById('occasion-whatsapp').value,'08012345678');
  await h.submit();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert(document.body.textContent.includes('DH-EVT-RETRY'));
 }finally{await h.close();}
});
test('a list-only upload can be submitted without choosing catalogue bottles or a budget',async()=>{
 const h=await mount();const calls=[];global.fetch=async(url,options)=>{calls.push(options.body);return {ok:true,json:async()=>({success:true,data:{reference:'DH-EVT-FILE',dueAt:'2026-10-21T18:00:00Z',conversationId:'thread-id',channel:'email'}})};};
 try{
  await h.change('occasion-city','Abuja');await h.change('occasion-name','Ada');await h.change('occasion-email','ada@example.test');await React.act(async()=>document.getElementById('occasion-consent').click());
  const file=new File(['Wine x10'],'wedding-list.txt',{type:'text/plain'});
  await React.act(async()=>{const input=document.getElementById('occasion-list-file');Object.defineProperty(input,'files',{value:[file],configurable:true});input.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));});
  assert.equal(calls.filter(item=>item).length,0);await h.submit();assert.equal(calls.filter(item=>item).length,1);assert.equal(calls.filter(item=>item)[0].get('file').name,'wedding-list.txt');
 }finally{await h.close();}
});
test('catalogue bottle quantities reach the backend as valid numeric requests without price or pack fields',async()=>{
 const h=await mount();let submitted;
 global.fetch=async(url,options)=>String(url).includes('/api/products/search?')?{ok:true,json:async()=>({success:true,data:{products:[{_id:'507f1f77bcf86cd799439011',name:'Reception Wine',slug:'reception-wine'}]}})}:{ok:true,json:async()=>{submitted=JSON.parse(options.body.get('payload'));return {success:true,data:{reference:'DH-EVT-BOTTLE',dueAt:'2026-10-21T18:00:00Z',conversationId:'thread-id',channel:'email'}};}};
 try{
  await h.change('wedding-bottle-search','Reception');await React.act(async()=>document.querySelector('#wedding-bottle-list form').dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true})));
  await React.act(async()=>[...document.querySelectorAll('button')].find(el=>el.textContent==='Add Reception Wine').click());
  await h.change('bottle-1-quantity','12');await h.change('occasion-city','Abuja');await h.change('occasion-name','Ada');await h.change('occasion-email','ada@example.test');await React.act(async()=>document.getElementById('occasion-consent').click());await h.submit();
  assert.equal(submitted.items[0].quantity,12);assert.equal(submitted.items[0].productId,'507f1f77bcf86cd799439011');assert.equal(submitted.items[0].unitPrice,undefined);assert.equal(submitted.items[0].size,undefined);
  const {validateRequest}=require(path.resolve(sourceRoot,'../../../../server/utils/occasionRequestInput'));
  assert.equal(validateRequest(submitted).items[0].quantity,12);
 }finally{await h.close();}
});

test('invalid occasion brief focuses and describes the field that needs correcting', async () => {
 const h = await mount();
 try {
  await h.submit();
  const city = document.getElementById('occasion-city');
  assert(document.activeElement === city, 'validation should bring the customer to the missing city');
  assert.equal(city.getAttribute('aria-invalid'), 'true');
  assert.equal(city.getAttribute('aria-describedby'), 'occasion-form-error');
  assert(document.getElementById('occasion-form-error').textContent.includes('delivery city'));
 } finally { await h.close(); }
});
