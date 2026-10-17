const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react');
const {JSDOM}=Module.createRequire(path.resolve(__dirname,'../../../../admin/package.json'))('jsdom');
test('modal keyboard navigation skips empty results and does not steal Enter from buttons',async()=>{
 const dom=new JSDOM('<button id="opener">Search</button><div id="root"></div>',{url:'http://localhost'});
 const previous={window:global.window,document:global.document};
 Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');
 dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
 let open=true, searches=0;
 const data={searchQuery:'',searchResults:null,isSearching:false,searchError:null,recentSearches:[],popularSearches:[],suggestions:['Wine'],isLoadingSuggestions:false,hasMore:false,
 setSearchQuery(){},removeRecentSearch(){},clearRecentSearches(){},fetchSuggestions(){},performSearch(){searches++;},loadMoreResults(){}};
 const motion={};for(const tag of ['div','p','button']) motion[tag]=React.forwardRef((props,ref)=>{
 const {initial,animate,exit,transition,variants,layout,whileHover,...rest}=props;return React.createElement(tag,{...rest,ref});});
 const navigation={useRouter:()=>({push(){}})};
 function load(file){const m=new Module(file,module);m.paths=module.paths;m.require=name=>{
  if(name==='next/navigation')return navigation;
  if(name==='next/image')return {__esModule:true,default:()=>null};
  if(name==='framer-motion')return {motion,AnimatePresence:({children})=>children};
  if(name==='@/context/ModalSearchContext')return {useModalSearchContext:()=>data,useModalSearchUIContext:()=>({isModalOpen:open,closeModalSearch(){open=false;}})};
  if(name==='@/context/ShoppingLocationContext')return {useShoppingLocation:()=>({location:null})};
  if(name==='@/context/ModalQuickviewContext')return {useModalQuickviewContext:()=>({})};
  if(name==='@/lib/fetchWithAuth')return {fetchWithAuth(){}};
  if(name==='@/lib/api')return {API_URL:''};
  if(name.startsWith('@/')||name.startsWith('.')) {const base=name.startsWith('@/')?path.resolve(__dirname,'../..',name.slice(2)):path.resolve(path.dirname(file),name);return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)));}
  return require(name);
 };m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;}
 const Modal=load(path.join(__dirname,'ModalSearch.tsx')).default,root=createRoot(document.getElementById('root'));
 const render=()=>root.render(React.createElement(Modal));
 const key=(target,name)=>{const event=new dom.window.KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true});target.dispatchEvent(event);return event;};
 try{
  document.getElementById('opener').focus();
  await React.act(async()=>{render();await new Promise(r=>setTimeout(r,100));});
  const input=document.querySelector('input');input.focus();
  await React.act(async()=>key(input,'ArrowDown'));
  assert.equal(input.getAttribute('aria-activedescendant'),null);
  data.searchQuery='wine';data.searchResults={products:[{_id:'one',name:'One'},{_id:'two',name:'Two'}],total:2,totalPages:1,page:1};
  await React.act(async()=>render());
  await React.act(async()=>key(input,'ArrowUp'));
  assert.equal(input.getAttribute('aria-activedescendant'),'search-product-1');
  const suggestion=[...document.querySelectorAll('button')].find(b=>b.textContent==='Wine');suggestion.focus();
  assert.equal(key(suggestion,'Enter').defaultPrevented,false);
  assert.equal(searches,0);
  await React.act(async()=>{key(input,'Escape');render();});
  assert.equal(document.activeElement.id,'opener');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
