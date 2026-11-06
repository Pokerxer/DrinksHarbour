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
      if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: true, isLoading: false, token: 'customer-token', user: { _id: 'ada', role: 'customer' } }) };
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

const initial={request:{_id:'thread',reference:'DH-EVT-ONE',occasion:'weddings',city:'Abuja',guests:300,budget:5000000,notes:'180 adult drinkers',preferences:['wine'],items:[],status:'pending',createdAt:'2026-10-21T12:00:00Z',draft:'PRIVATE AI DRAFT'},messages:[{_id:'0001',sender:'customer',content:'Please include non-alcoholic choices.',createdAt:'2026-10-21T12:01:00Z'},{_id:'0002',sender:'staff',content:'Our reviewed plan includes juice and wine.',createdAt:'2026-10-21T12:02:00Z'}],olderCursor:null};
test('profile Chat lists saved requests and opens their existing conversations',async()=>{
 global.fetch=async()=>({ok:true,json:async()=>({success:true,data:{requests:[initial.request],page:1,pages:1,total:1}})});
 const List=load('components/CustomerChat/ConversationList.tsx').default;
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/my-account/chat'}),prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client'),root=createRoot(document.getElementById('root'));
 try{await React.act(async()=>root.render(React.createElement(List)));assert(document.querySelector('a[href="/my-account/chat/thread"]'));assert(document.body.textContent.includes('DH-EVT-ONE'));const {NAV_ITEMS}=load('app/my-account/_constants.ts');assert(NAV_ITEMS.some(item=>item.label==='Chat'&&item.href==='/my-account/chat'));}finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});
test('saved customer and staff messages survive reopening; failed follow-ups keep their text and retry key',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/my-account/chat/thread'}),prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 let fail=true;const keys=[],stored=[...initial.messages],calls=[];
 global.fetch=async(url,options={})=>{calls.push(url);if(options.method==='POST'){const input=JSON.parse(options.body);keys.push(input.messageKey);if(fail)throw Error('Network unavailable');const message={_id:'0003',sender:'customer',content:input.content,createdAt:'2026-10-21T12:03:00Z'};stored.push(message);return {ok:true,json:async()=>({success:true,data:message})};}return {ok:true,json:async()=>({success:true,data:{...initial,messages:stored}})};};
 const Page=load('components/CustomerChat/ConversationPage.tsx').default,{createRoot}=require('react-dom/client');let root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(Page,{id:'thread'})));
  assert(document.body.textContent.includes('Please include non-alcoholic choices.'));assert(document.body.textContent.includes('Our reviewed plan includes juice and wine.'));assert(!document.body.textContent.includes('PRIVATE AI DRAFT'));assert(document.querySelector('[role=log] article p:nth-child(2)').textContent.includes('Abuja\n300 guests'), 'original brief separates event details with real new lines');
  await React.act(async()=>{const input=document.getElementById('customer-chat-message');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,'Change to250 guests please.');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  const submit=()=>React.act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
  await submit();assert.equal(document.getElementById('customer-chat-message').value,'Change to250 guests please.');fail=false;await submit();assert.equal(keys[0],keys[1]);assert.equal(document.getElementById('customer-chat-message').value,'');assert(document.querySelector('[role=log]').textContent.includes('Change to250 guests please.'));
  await React.act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await React.act(async()=>root.render(React.createElement(Page,{id:'thread'})));assert(document.body.textContent.includes('Change to250 guests please.'));assert(document.body.textContent.includes('Our reviewed plan includes juice and wine.'));assert(calls.every(url=>!String(url).includes('chatbot')));
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('a successful background refresh clears a previous conversation load failure', async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/my-account/chat/thread' });
 const prior = { window: global.window, document: global.document, fetch: global.fetch, setInterval: global.setInterval, clearInterval: global.clearInterval, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
 let poll, fail = true;
 Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true, setInterval: callback => { poll = callback; return 1; }, clearInterval: () => {} });
 Object.defineProperty(document, 'hidden', { value: false });
 global.fetch = async () => { if (fail) throw Error('Temporary connection problem'); return { ok: true, json: async () => ({ success: true, data: initial }) }; };
 const Page = load('components/CustomerChat/ConversationPage.tsx').default;
 const root = require('react-dom/client').createRoot(document.getElementById('root'));
 try {
  await React.act(async () => root.render(React.createElement(Page, { id: 'thread' })));
  assert(document.querySelector('[role=alert]'));
  fail = false;
  await React.act(async () => poll());
  assert(document.querySelector('[role=log]'));
  assert(!document.querySelector('[role=alert]'), 'recovered conversation should remove the stale failure');
 } finally { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); }
});

test('earlier messages from a previous conversation cannot enter the newly opened thread', async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/my-account/chat/thread' });
 const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
 Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
 let finishOlder;
 const api = { read: async (id, cursor) => cursor && cursor.before ? new Promise(resolve => { finishOlder = resolve; }) : { ...initial, request: { ...initial.request, reference: id }, messages: [], olderCursor: !cursor && id === 'first' ? 'older' : null } };
 const Page = load('components/CustomerChat/ConversationPage.tsx', { '@/lib/customerConversation': { customerConversation: api } }).default;
 const root = require('react-dom/client').createRoot(document.getElementById('root'));
 try {
  await React.act(async () => root.render(React.createElement(Page, { id: 'first' })));
  await React.act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Load earlier messages').click());
  await React.act(async () => root.render(React.createElement(Page, { id: 'second' })));
  await React.act(async () => finishOlder({ ...initial, messages: [{ _id: 'old-private', sender: 'customer', content: 'ONLY FIRST THREAD', createdAt: '2026-10-21T12:01:00Z' }], olderCursor: null }));
  assert(!document.body.textContent.includes('ONLY FIRST THREAD'), 'old thread content must never appear in the new conversation');
 } finally { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); }
});

test('the conversation header reports the backend status; Enter submits and coarse keyboards keep their default', async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/my-account/chat/thread' });
 const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
 Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
 const keys = [], gates = [];
 const customerOnly = [{ _id: '0001', sender: 'customer', content: 'Please include non-alcoholic choices.', createdAt: new Date().toISOString() }];
 global.fetch = async (url, options = {}) => {
  if (options.method === 'POST') {
   const input = JSON.parse(options.body);
   return new Promise((resolve, reject) => {
    keys.push(input.messageKey);
    gates.push(queued => queued ? resolve({ ok: true, json: async () => ({ success: true, data: { _id: '0009', sender: 'customer', content: input.content, createdAt: new Date().toISOString() } }) }) : reject(Error('Network unavailable')));
   });
  }
  return { ok: true, json: async () => ({ success: true, data: { ...initial, request: { ...initial.request, status: 'delivery_failed' }, messages: customerOnly } }) };
 };
 const Page = load('components/CustomerChat/ConversationPage.tsx').default;
 const root = require('react-dom/client').createRoot(document.getElementById('root'));
 try {
  await React.act(async () => root.render(React.createElement(Page, { id: 'thread' })));
  assert(document.body.textContent.includes('We could not deliver your reviewed plan.'), 'the header line surfaces the delivery_failed copy honestly');
  assert(document.body.textContent.includes('email or WhatsApp, as you chose'), 'the header keeps the consented-channel recovery copy');
  await React.act(async () => { const input = document.getElementById('customer-chat-message'); Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Move the date forward please.'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  const press = init => React.act(async () => document.getElementById('customer-chat-message').dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', ...init })));
  await press({ shiftKey: true });
  assert.equal(keys.length, 0, 'Shift+Enter keeps editing instead of sending');
  await press({});
  assert.equal(keys.length, 1, 'Enter submits the composer');
  await React.act(async () => gates[0](true));
  assert(document.querySelector('[role=log]').textContent.includes('Move the date forward please.'), 'the sent message joins the log');
  assert.equal(document.getElementById('customer-chat-message').value, '');
  assert(!document.getElementById('customer-chat-message').disabled, 'the composer is free again once the send resolves');
  dom.window.matchMedia = query => ({ matches: /coarse|hover: none/.test(query), media: query, addEventListener() {}, removeEventListener() {} });
  await React.act(async () => { const input = document.getElementById('customer-chat-message'); Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Typed on a phone.'); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
  await press({});
  assert.equal(keys.length, 1, 'coarse-pointer keyboards are never hijacked');
 } finally { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); }
});

test('profile-thread timestamps group by WAT day — Today, Yesterday and the plain legacy date', async () => { const formatting = load('lib/chatFormatting.ts');
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/my-account/chat/thread' });
 const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
 Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
 const now = new Date();
 const wat = new Date(now.getTime() + 3600e3);
 const startOfWatToday = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate());
 const stale = [
  { _id: '0001', sender: 'customer', content: 'Older note.', createdAt: new Date(startOfWatToday - 40 * 86400e3).toISOString() },
  { _id: '0002', sender: 'staff', content: 'Later note.', createdAt: new Date(startOfWatToday - 40 * 86400e3 + 3600e3).toISOString() },
  { _id: '0003', sender: 'customer', content: 'Yesterday note.', createdAt: new Date(startOfWatToday - 12 * 3600e3).toISOString() },
  { _id: '0004', sender: 'staff', content: 'Today note.', createdAt: now.toISOString() },
 ];
 global.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: { ...initial, messages: stale } }) });
 const Page = load('components/CustomerChat/ConversationPage.tsx').default;
 const root = require('react-dom/client').createRoot(document.getElementById('root'));
 try {
  await React.act(async () => root.render(React.createElement(Page, { id: 'thread' })));
  const log = document.querySelector('[role=log]').textContent;
  assert(log.includes('Today'), 'a Today divider exists');
  assert(log.includes('Yesterday'), 'a Yesterday divider exists');
  assert(log.includes(formatting.chatDayLabel(stale[0].createdAt, now)), 'older threads read as their plain WAT date');
  assert(log.indexOf(formatting.chatDayLabel(stale[0].createdAt, now)) < log.indexOf('Yesterday'), 'groups land in chronological order');
  assert(log.includes('WAT'), 'times stay labelled WAT');
 } finally { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); }
});

test('auth failures on the profile thread offer a sign-in route back to the same conversation', async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/my-account/chat/thread' });
 const prior = { window: global.window, document: global.document, fetch: global.fetch, IS_REACT_ACT_ENVIRONMENT: global.IS_REACT_ACT_ENVIRONMENT };
 Object.assign(global, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
 global.fetch = async () => { throw Error('Please sign in to view this conversation.'); };
 const Page = load('components/CustomerChat/ConversationPage.tsx').default;
 const root = require('react-dom/client').createRoot(document.getElementById('root'));
 try {
  await React.act(async () => root.render(React.createElement(Page, { id: 'thread' })));
  const alert = document.querySelector('[role=alert]');
  assert(alert, 'the load failure is announced');
  const signIn = alert.querySelector('a[href*="/login"]');
  assert(signIn, 'auth dead-ends offer a sign-in route');
  assert.equal(signIn.textContent, 'Sign in to continue');
  assert.match(signIn.getAttribute('href'), /redirect=%2Fmy-account%2Fchat%2Fthread/, 'signing in returns to the same conversation');
  assert(alert.textContent.includes('Refresh conversation'), 'the reload affordance stays alongside');
 } finally { await React.act(async () => root.unmount()); dom.window.close(); Object.assign(global, prior); }
});

test('listed conversations surface the server-computed unread counts as accessible badges',async()=>{
 const unreadRow={...initial.request,customerUnreadCount:2};
 const quiet={...initial.request,_id:'quiet',reference:'DH-EVT-TWO'};

 global.fetch=async()=>({ok:true,json:()=>Promise.resolve({success:true,data:{requests:[unreadRow,quiet],page:1,pages:1,total:2}})});
 const List=load('components/CustomerChat/ConversationList.tsx').default;
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/my-account/chat'}),prior={window:global.window,document:global.document,fetch:global.fetch,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client'),root=createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(List)));
  assert(document.body.textContent.includes('2 unread replies from our team'),'the unread row names its count accessibly');
  assert(!document.body.textContent.includes('0 unread replies'),'a read conversation never shows an unread badge');
  const badge=[...document.querySelectorAll('span')].find(span=>span.textContent==='2 unread replies from our team');
  assert(badge,'the unread row is reachable through describeable sr-only markup');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});

test('the profile thread polls incrementally past the last id; every load doubles as the read call',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/my-account/chat/thread'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,setInterval:global.setInterval,clearInterval:global.clearInterval,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 let poll=null;
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true,setInterval:(callback,ms)=>{if(ms===10000)poll=callback;return 1;},clearInterval:()=>{}});
 Object.defineProperty(document,'hidden',{value:false});
 const server=[...initial.messages],calls=[];
 global.fetch=async(url,options={})=>{
  calls.push(String(url));
  if(options.method==='POST')return{ok:true,json:async()=>({success:true,data:{_id:'0009',sender:'customer',content:'queued',createdAt:'2026-11-06T12:03:00Z'}})};
  return{ok:true,json:()=>Promise.resolve({success:true,data:{...initial,messages:server}})};
 };
 const Page=load('components/CustomerChat/ConversationPage.tsx').default;
 const root=require('react-dom/client').createRoot(document.getElementById('root'));
 try{
  await React.act(async()=>root.render(React.createElement(Page,{id:'thread'})));
  assert(/\/api\/occasion-requests\/thread\/messages$/.test(calls[0]),`opening the conversation issues the server read call (${calls[0]})`);
  assert(!calls[0].includes('after='),'the first read is a full read');
  assert(document.querySelector('[role=log]'));
  server.push({_id:'0003',sender:'staff',content:'A refreshed reviewed plan.',createdAt:'2026-11-06T12:05:00Z'});
  await React.act(async()=>poll());
  assert(calls[1].includes('after=0002'),`the tick re-reads past the newest server id (${calls[1]})`);
  assert(document.querySelector('[role=log]').textContent.includes('A refreshed reviewed plan.'),'the incremental merge renders the new reply');
  calls.length=0;
  await React.act(async()=>poll());
  assert(calls[0].includes('after='),'the tick still starts incremental');
  assert(calls.some(url=>!url.includes('after=')),`an unclear response falls back to the full read (${calls.join(' | ')})`);
  assert(document.querySelector('[role=log]').textContent.includes('A refreshed reviewed plan.'),'the fallback keeps the merged history');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});
