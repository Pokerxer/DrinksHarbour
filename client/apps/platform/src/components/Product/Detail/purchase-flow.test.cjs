const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const ts=require('typescript'),React=require('react');
const {JSDOM}=Module.createRequire(path.resolve(__dirname,'../../../../../admin/package.json'))('jsdom');
test('detail cart quantity follows stock, size and seller changes while keeping explicit choices',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/product/wine'});
 const previous={window:global.window,document:global.document};Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=require('react-dom/client');let added;
 const Empty=()=>null;
 function load(file){const m=new Module(file,module);m.paths=module.paths;m.require=name=>{
  if(name.endsWith('.css')||name.startsWith('swiper/css'))return {};
  if(name==='next/navigation')return {useRouter:()=>({push(){}})};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name==='swiper/react')return {Swiper:({children})=>React.createElement('div',null,children),SwiperSlide:({children})=>React.createElement('div',null,children)};
  if(name==='swiper/modules')return {};
  if(name==='commerce-core')return load(require.resolve(name));
  if(name==='@/context/CartContext')return {useCart:()=>({addToCart:async(...args)=>{added=args;}})};
  if(name==='@/context/WishlistContext')return {useWishlist:()=>({wishlistState:{wishlistArray:[]}})};
  if(name==='@/context/CompareContext')return {useCompare:()=>({isInCompare:()=>false})};
  if(name.startsWith('@/context/Modal'))return {[`use${name.split('/').at(-1)}`]:()=>({})};
  if(name==='@/components/UI/OptimizedImage')return {__esModule:true,default:Empty};
  if(name==='@/components/WhatsApp/whatsappLink')return load(path.resolve(__dirname,'../../WhatsApp/whatsappLink.ts'));
  if(name.startsWith('@/components/')&&!name.includes('ShoppingLocation'))return {__esModule:true,default:Empty};
  if(['./RelatedProducts','./ShareButton','./ProductSpecifications'].includes(name))return {__esModule:true,default:Empty};
  if(name.startsWith('@/')||name.startsWith('.')){
   const base=name.startsWith('@/')?path.resolve(__dirname,'../../..',name.slice(2)):path.resolve(path.dirname(file),name);
   return load([base,base+'.ts',base+'.tsx'].find(f=>fs.existsSync(f)));
  }
  return require(name);
 };m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return m.exports;}
 const Detail=load(path.join(__dirname,'index.tsx')).default;
 const size=(id,stock,min=1)=>({_id:id,size:id,displayName:id,stock,minOrderQuantity:min,maxOrderQuantity:20,pricing:{websitePrice:1000,currencySymbol:'₦'}});
 let product={_id:'wine',name:'Wine',images:[],shoppingOffer:{subProductId:'a',sizeId:'large'},availableAt:[{_id:'a',tenant:{_id:'tenant-a',name:'Nearby seller'},sizes:[size('small',2),size('large',4)]},{_id:'b',tenant:{_id:'tenant-b',name:'Other seller'},sizes:[size('bottle',1),size('case',2,6)]}]};
 const root=createRoot(document.getElementById('root'));let blocked=false;
 const render=()=>root.render(React.createElement(Detail,{productData:product,purchaseBlocked:blocked}));
 const button=label=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent.includes(label));
 try{
  await React.act(async()=>render());
  assert.equal(button('large').getAttribute('aria-pressed'),'true','representative size is the default');
  for(let i=0;i<6;i++)await React.act(async()=>button('Increase quantity').click());
  assert.equal(document.querySelector('output').textContent,'4');assert.equal(button('Increase quantity').disabled,true);
  await React.act(async()=>button('Add to cart').click());assert.equal(added[5],4);assert.equal(added[6],'large');assert.equal(added[7],'a');
  await React.act(async()=>button('small').click());assert.equal(document.querySelector('output').textContent,'2');
  await React.act(async()=>button('Other seller').click());assert.equal(document.querySelector('output').textContent,'1');assert.equal(button('case').disabled,true);
  product={...product,availableAt:[...product.availableAt].reverse()};await React.act(async()=>render());
  assert.equal(button('Other seller').getAttribute('aria-pressed'),'true');
  blocked=true;await React.act(async()=>render());assert.equal(button('Currently unavailable').disabled,true);
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
