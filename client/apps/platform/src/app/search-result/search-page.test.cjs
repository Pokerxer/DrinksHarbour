const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react'),{createRoot}=require('react-dom/client');
const {JSDOM}=Module.createRequire(path.resolve(__dirname,'../../../../admin/package.json'))('jsdom');
test('result pagination moves one page and failures show retry instead of an empty catalogue',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/search-result?query=wine'});
 const previous={window:global.window,document:global.document,fetch:global.fetch};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.scrollTo=()=>{};
 const requests=[]; global.fetch=(url)=>new Promise(resolve=>requests.push({url,resolve}));
 const params=new URLSearchParams('query=wine');
 const router={push(){}};
 const shopping={location:null,revision:''};
 function load(file){
  const m=new Module(file,module);m.paths=module.paths;
  m.require=name=>{
   if(name==='next/navigation') return {useSearchParams:()=>params,useRouter:()=>router};
   if(name==='@/context/ShoppingLocationContext') return {useShoppingLocation:()=>shopping};
   if(name==='@/lib/shoppingRequest') return {shoppingHeaders:()=>({})};
   if(name==='@/components/Breadcrumb/Breadcrumb') return {__esModule:true,default:()=>null};
   if(name==='@/components/Product/Card') return {__esModule:true,default:({data})=>React.createElement('p',null,data.name)};
   if(name.startsWith('@/')) return load(path.resolve(__dirname,'../..',name.slice(2))+'.tsx');
   if(name.startsWith('.')) {const base=path.resolve(path.dirname(file),name);return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)));}
   return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;
 }
 const Page=load(path.join(__dirname,'page.tsx')).default;
 const root=createRoot(document.getElementById('root'));
 const reply={ok:true,json:async()=>({success:true,data:{products:Array.from({length:8},(_,i)=>({_id:'wine'+i,name:'Wine'})),pagination:{totalResults:32}}})};
 try{
  await React.act(async()=>root.render(React.createElement(Page)));
  await React.act(async()=>requests.shift().resolve(reply));
  const buttons=[...document.querySelectorAll('button')];
  await React.act(async()=>buttons.at(-1).click());
  assert.match(requests[0].url,/page=2(?:&|$)/,'next must move one page, not jump to the last');
  await React.act(async()=>requests.shift().resolve({ok:false,status:503}));
  assert.ok(document.querySelector('[role="alert"]'),'service failures are not no-results');
  const retry=[...document.querySelectorAll('button')].find(b=>/try again|retry/i.test(b.textContent));
  assert.ok(retry);
  await React.act(async()=>retry.click());
  assert.match(requests[0].url,/page=2(?:&|$)/);
  await React.act(async()=>requests.shift().resolve(reply));
  assert.match(document.body.textContent,/9.*16.*32/,'range uses catalogue total');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
