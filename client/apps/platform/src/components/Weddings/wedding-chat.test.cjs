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

test('wedding AI handoff opens the actual widget, preserves input and waits for Send',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/occasions/weddings'});
 const prior={window:global.window,document:global.document,fetch:global.fetch,CustomEvent:global.CustomEvent,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(global,{window:dom.window,document:dom.window.document,CustomEvent:dom.window.CustomEvent,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 dom.window.HTMLElement.prototype.scrollTo=function(){};
 const calls=[];global.fetch=async(url,options)=>{calls.push({url:String(url),body:options?.body});return {ok:true,json:async()=>({success:true,data:{greeting:'Hello. How can I help?'}})};};
 const bridge=load('lib/chatPlanning.ts');
 const mocks={'@/lib/chatPlanning':bridge,'@/context/CartContext':{useCart:()=>({cartCount:0,addToCart(){throw new Error('No cart action expected');}})}};
 const BottleList=load('components/Weddings/WeddingBottleList.tsx',mocks).default;
 const ChatHelp=load('components/Weddings/WeddingChatHelp.tsx',mocks).default;
 function Planner(){const [items,setItems]=React.useState([{id:'bottle-1',productId:'p1',name:'Reception wine',slug:'reception-wine',quantity:'1',size:'',unit:'bottles'}]);return React.createElement(React.Fragment,null,React.createElement(BottleList,{items,onChange:setItems}),React.createElement(ChatHelp,{items,interests:''}));}
 const Widget=load('components/Chatbot/ChatbotWidget.tsx',mocks).default;
 const {createRoot}=require('react-dom/client');const root=createRoot(document.getElementById('root'));
 async function change(el,value){await React.act(async()=>{const proto=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
 async function click(text){const button=[...document.querySelectorAll('button')].find(el=>el.textContent===text);assert(button,`missing ${text}`);await React.act(async()=>button.click());}
 try{
  await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(Planner),React.createElement(Widget))));
  const composer=document.querySelector('textarea[placeholder^="Ask about drinks"]');await change(composer,'Keep my own question.');
  await click('Open in floating chat');
  assert(document.querySelector('[aria-label="Wedding AI draft"]'),'the current list must be previewed in the widget');
  assert.match(document.querySelector('[aria-label="Wedding AI draft"]').textContent,/Reception wine/);
  assert.equal(composer.value,'Keep my own question.');
  await React.act(async()=>new Promise(resolve=>setTimeout(resolve,380)));
  assert.notEqual(document.activeElement,composer,'reviewing the list must not open a mobile keyboard before Add list to message');
  assert(!calls.some(call=>String(call.body).includes('Reception wine')),'opening must not transmit the list');
  await click('Add list to message');
  assert.match(composer.value,/Keep my own question/);assert.match(composer.value,/Reception wine/);
  assert.equal(document.querySelector('[aria-label="Wedding AI draft"]'),null);
  assert(!calls.some(call=>String(call.body).includes('Reception wine')),'prefilling must still wait for Send');
  await click('Open in floating chat');await click('Dismiss wedding draft');
  assert.equal(document.querySelector('[aria-label="Wedding AI draft"]'),null);
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,prior);}
});
