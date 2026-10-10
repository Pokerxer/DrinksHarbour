const test=require('node:test');
const assert=require('node:assert/strict');
const InventoryMovement=require('../models/InventoryMovement');
const inventory=require('../services/inventory.service');
const tenant='699165839f3308b1baeca8fc';
const matches=(row,query)=>Object.entries(query).every(([key,value])=>{
 if(key==='$or')return value.some(branch=>matches(row,branch));
 if(value instanceof RegExp)return value.test(row[key]||'');
 if(value&&typeof value==='object'&&!value._bsontype){
  if('$in' in value)return value.$in.includes(row[key]);
  if('$ne' in value)return row[key]!=value.$ne;
 }
 return String(row[key])===String(value);
});
test('internal scope includes transfer returns, excludes ordinary returns and preserves tenant counts',async(t)=>{
 const rows=[
 {_id:'out',tenant,type:'transfer_out',category:'transfer'},
 {_id:'in',tenant,type:'transfer_in',category:'transfer'},
 {_id:'return',tenant,type:'return',category:'in',referenceType:'return',reference:'Return of transfer TRF-1',sourceWarehouse:'holding',destinationWarehouse:'origin'},
 {_id:'vendor',tenant,type:'return_out',category:'out',referenceType:'purchase_order'},
 {_id:'customer',tenant,type:'return',category:'in'},
 {_id:'other-tenant',tenant:'699165839f3308b1baeca8fd',type:'transfer_in',category:'transfer'},
 ];
 t.mock.method(InventoryMovement,'find',query=>{
 const chain={sort(){return this;},skip(){return this;},limit(){return this;},populate(){return this;},lean:async()=>rows.filter(row=>matches(row,query))};return chain;
 });
 t.mock.method(InventoryMovement,'countDocuments',async query=>rows.filter(row=>matches(row,query)).length);
 const result=await inventory.getMovements(tenant,{scope:'internal'});
 assert.deepEqual(result.data.movements.map(row=>row._id),['out','in','return']);
 assert.equal(result.data.total,3);
 const ordinary=await inventory.getMovements(tenant,{category:'in'});
 assert.deepEqual(ordinary.data.movements.map(row=>row._id),['return','customer']);
});
