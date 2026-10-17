const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react');
const {JSDOM}=Module.createRequire(path.resolve(__dirname,'../../../../admin/package.json'))('jsdom');
test('secondary navigation remains reachable in Browse and closes on Escape and navigation',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});
 const previous={window:global.window,document:global.document};Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');
 document.addEventListener('click',event=>event.preventDefault());
 const file=path.join(__dirname,'HeaderNav.tsx'),m=new Module(file,module);m.paths=module.paths;
 m.require=name=>name==='next/link'?{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}:require(name);
 m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
 const root=createRoot(document.getElementById('root'));
 const links=[{name:'Shop',href:'/shop'},{name:'Brands',href:'/brands'},{name:'Sale',href:'/deals',sale:true}];
 try{
  await React.act(async()=>root.render(React.createElement(m.exports.HeaderNav,{navLinks:links,variant:'default',getTextColor:()=>'',pathname:'/brands'})));
  const details=document.querySelector('details');assert.ok(details,'secondary links should use a compact disclosure');
  assert.ok(details.querySelector('a[href="/brands"]'));
  details.open=true;await React.act(async()=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
  assert.equal(details.open,false);
  assert.equal(document.activeElement,details.querySelector('summary'));
  details.open=true;await React.act(async()=>document.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true})));
  assert.equal(details.open,false,'clicking outside closes Browse');
  details.open=true;await React.act(async()=>details.querySelector('a').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true})));
  assert.equal(details.open,false);
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
