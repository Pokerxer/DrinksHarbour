import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addBottle, describeBottleList, validateBottleList, bottleSummary, publicBottleChoices} from './weddingBottleList.ts';

test('custom duplicate bottles merge while edited sizes and units stay separate',()=>{
  let result=addBottle([], {name:'  Wedding   wine '});
  assert.equal(result.items[0].name,'Wedding wine');
  result=addBottle(result.items,{name:'wedding wine'});
  assert.equal(result.items.length,1);assert.equal(result.items[0].quantity,'2');
  const sized=result.items.map(row=>({...row,size:'750ml',unit:'cases'}));
  const next=addBottle(sized,{name:'Wedding wine'});
  assert.equal(next.items.length,2);
  assert.equal(next.items[0].unit,'cases');
});
test('catalogue identity does not merge different products or a custom name',()=>{
  let rows=addBottle([],{name:'Wine',productId:'p1',slug:'wine-one'}).items;
  rows=addBottle(rows,{name:'Wine',productId:'p2',slug:'wine-two'}).items;
  rows=addBottle(rows,{name:'Wine'}).items;
  assert.equal(rows.length,3);
});

test('explicit AI product selection adds the suggested quantity and prevents overflow',()=>{
 const choice={name:'Apple Juice',productId:'juice',slug:'apple-juice',suggestedQuantity:12};
 const first=addBottle([],choice);
 assert.equal(first.items[0].quantity,'12');
 assert.equal(addBottle(first.items,choice).items[0].quantity,'24');
 assert(addBottle([{...first.items[0],quantity:'9990'}],choice).error);
 for(const suggestedQuantity of [0,-1,1.5,10000])assert(addBottle([],{...choice,suggestedQuantity}).error);
});
test('list validation blocks invalid quantities, oversized entries and row limits',()=>{
  const row=addBottle([],{name:'Wine'}).items[0];
  for(const quantity of ['','0','-1','1.5','10000','NaN']) assert(validateBottleList([{...row,quantity}]));
  assert.equal(validateBottleList([{...row,quantity:'9999'}]),undefined);
  assert(addBottle([],{name:' '}).error);
  assert(addBottle([],{name:'a'.repeat(121)}).error);
  let rows=[];for(let i=0;i<20;i++) rows=addBottle(rows,{name:`Wine ${i}`}).items;
  assert(addBottle(rows,{name:'Another wine'}).error);
  assert(addBottle([{...row,quantity:'9999'}],{name:'Wine'}).error);
});
test('export preserves quantities and units without inventing size, price or case count',()=>{
  const a=addBottle([],{name:'Wine',productId:'p1',slug:'wine'}).items[0];
  const b=addBottle([],{name:'Water'}).items[0];
  const rows=[{...a,quantity:'12',size:'750 ml'},{...b,id:'2',quantity:'3',unit:'cases'}];
  assert.equal(describeBottleList(rows),'Bottle list:\n12 bottles — Wine — 750 ml [catalogue: wine]\n3 cases — Water — size to confirm [custom]');
  assert.equal(bottleSummary(rows),'12 bottles · 3 cases');
  assert.equal(describeBottleList([]),'');
  assert.equal(describeBottleList([{...a,quantity:''}]),'');
});
test('public search projection keeps only usable public bottle identity',()=>{
  const rows=publicBottleChoices({success:true,data:{products:[{_id:'p1',name:'Wine',slug:'wine',costPrice:1},{_id:'p2',name:'Bad',slug:'../bad'},null]}});
  assert.deepEqual(rows,[{productId:'p1',name:'Wine',slug:'wine'}]);
  assert.throws(()=>publicBottleChoices({success:false}));
});

test('public choices keep catalogue images from supported shapes and reject unsafe URLs',()=>{
 const product=(id,extra)=>({_id:id,name:'Juice',slug:`juice-${id}`,...extra});
 const rows=publicBottleChoices({success:true,data:{products:[
  product('one',{primaryImage:{url:'https://res.cloudinary.com/demo/image/upload/one.jpg'}}),
  product('two',{images:[{url:'https://res.cloudinary.com/demo/image/upload/two.jpg'}]}),
  product('three',{images:['/images/juice.png']}),
  product('four',{image:'javascript:alert(1)'}),
 ]}});
 assert.equal(rows[0].image,'https://res.cloudinary.com/demo/image/upload/one.jpg');
 assert.equal(rows[1].image,'https://res.cloudinary.com/demo/image/upload/two.jpg');
 assert.equal(rows[2].image,'/images/juice.png');assert.equal(rows[3].image,undefined);
});
