const test = require('node:test');
const assert = require('node:assert/strict');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Product = require('../models/Product');
const Stock = require('../models/WarehouseStock');
const Tenant = require('../models/Tenant');
const Warehouse = require('../models/Warehouse');
const Pricelist = require('../models/Pricelist');
const { lookup } = require('../services/priceChecker/lookup');
const { loadContext } = require('../services/priceChecker/context');
const ids = ['a','b','c','d','e'].map(c=>c.repeat(24));
const context = { kiosk:{_id:ids[0],tenant:ids[1],location:ids[2],currency:'NGN',settings:{}},tenant:{},location:{},pricelist:null };
const q = value => ({select(){return this;},populate(){return this;},limit(){return this;},lean:async()=>value});
function mockCatalog(t, {stock = {currentQuantity:4,reservedQuantity:1}, sizes} = {}) {
  t.mock.method(Size,'find',filter=>{ assert.deepEqual(filter,{tenant:ids[1],barcode:'00123'}); return q(sizes || [{_id:ids[3],tenant:ids[1],subproduct:ids[4],barcode:'00123',size:'70cl',sellingPrice:200,status:'active'}]); });
  t.mock.method(SubProduct,'findOne',filter=>{ assert.equal(filter.tenant,ids[1]); assert.equal(filter._id,ids[4]); return q({_id:ids[4],product:ids[0],baseSellingPrice:100}); });
  t.mock.method(Product,'findOne',filter=>{ assert.equal(filter.status,'approved'); assert.equal(filter.isPublished,true);return q({_id:ids[0],name:'Exact bottle'}); });
  t.mock.method(Stock,'findOne',filter=>{ assert.deepEqual(filter,{tenant:ids[1],warehouse:ids[2],subProduct:ids[4],size:ids[3]});return q(stock); });
}
test('lookup binds exact barcode, tenant, size and branch stock', async t=>{
  mockCatalog(t);
  const result=await lookup(context,'00123');
  assert.equal(result.product.price,200); assert.equal(result.product.size,'70cl'); assert.equal(result.outcome,'FOUND');
  assert.equal(result.product.quantity,undefined);
});
test('ambiguous and unknown barcodes never fall back to a parent or another size',async t=>{
  mockCatalog(t,{sizes:[]});
  assert.equal((await lookup(context,'00123')).outcome,'UNKNOWN');
  t.mock.method(Size,'find',()=>q([{},{ }]));
  assert.equal((await lookup(context,'00123')).outcome,'AMBIGUOUS');
});
test('missing branch stock displays zero or hides according to kiosk configuration',async t=>{
  mockCatalog(t,{stock:null});
  assert.equal((await lookup(context,'00123')).product.availability,'OUT_OF_STOCK');
  assert.equal((await lookup({...context,kiosk:{...context.kiosk,settings:{outOfStock:'HIDE'}}},'00123')).outcome,'HIDDEN');
});
test('unpublished/off-tenant subproduct is unavailable even when a size exists',async t=>{
  mockCatalog(t); t.mock.method(SubProduct,'findOne',()=>q(null));
  assert.equal((await lookup(context,'00123')).outcome,'UNAVAILABLE');
});
test('context refuses a disabled kiosk before consulting tenant records',async()=>{
  await assert.rejects(loadContext({...context.kiosk,enabled:false}),/unavailable/i);
});
test('context refuses missing tenant, inactive location and changed shop binding',async t=>{
  const kiosk={...context.kiosk,enabled:true,mode:'STORE_ONLY',shopId:'retail'};
  t.mock.method(Tenant,'findOne',()=>q(null));
  t.mock.method(Warehouse,'findOne',()=>q(null));
  t.mock.method(Pricelist,'find',()=>q([]));
  await assert.rejects(loadContext(kiosk),/unavailable/i);
  t.mock.method(Tenant,'findOne',()=>q({name:'Shop',status:'approved',subscriptionStatus:'active',posSettings:{retailWarehouse:ids[2]}}));
  await assert.rejects(loadContext(kiosk),/unavailable/i);
  t.mock.method(Warehouse,'findOne',()=>q({_id:ids[2],isActive:true}));
  assert.equal((await loadContext(kiosk)).tenant.name,'Shop');
  t.mock.method(Tenant,'findOne',()=>q({status:'approved',subscriptionStatus:'active',posSettings:{retailWarehouse:ids[4]}}));
  await assert.rejects(loadContext(kiosk),/unavailable/i);
});
test('context rejects explicit off-branch and customer-restricted pricelists',async t=>{
  const kiosk={...context.kiosk,enabled:true,mode:'STORE_ONLY',shopId:'retail',pricelist:ids[3]};
  t.mock.method(Tenant,'findOne',()=>q({status:'approved',subscriptionStatus:'active',posSettings:{retailWarehouse:ids[2]}}));
  t.mock.method(Warehouse,'findOne',()=>q({_id:ids[2],isActive:true}));
  t.mock.method(Pricelist,'find',()=>q([{_id:ids[3],currency:'NGN',warehouses:[ids[4]]}]));
  await assert.rejects(loadContext(kiosk),/unavailable/i);
  t.mock.method(Pricelist,'find',()=>q([{_id:ids[3],currency:'NGN',warehouses:[ids[2]],customerTags:['vip']}]));
  await assert.rejects(loadContext(kiosk),/unavailable/i);
});
