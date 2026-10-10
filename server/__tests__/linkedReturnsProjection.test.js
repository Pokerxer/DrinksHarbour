const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const service = require('../services/linkedReturns.service');
const so = {_id:'so', tenant:'t', soNumber:'SO00008', items:[{_id:'line',subproduct:'sp',size:'sz',fulfilledQty:10,returnedQty:6}]};
const receipt = {_id:'pos',tenant:'t',linkedSalesOrder:'so',receiptNumber:'RCP',items:[{subproduct:'sp',size:'sz',quantity:10}],refunds:[]};
const chain = data => ({select(){return this;},lean:async()=>data});
test('POS and Sales history projections are tenant-scoped and never persist synthetic refunds', async t => {
 t.mock.method(SalesOrder,'find',q=>{assert.equal(q.tenant,'t'); return chain([so]);});
 t.mock.method(Order,'find',q=>{assert.equal(q.tenant,'t');assert.equal(q.source,'pos');return chain([receipt]);});
 const before=JSON.stringify({so,receipt});
 const [pos]=await service.projectPOSReturns([receipt],'t');
 assert.equal(pos.refunds[0].source,'sales');
 assert.equal(pos.refunds[0].items[0].quantity,6);
 assert.equal(pos.refunds[0].totalRefunded,0);
 const [sales]=await service.projectSalesReturns([so],'t');
 assert.equal(sales.items[0].returnedQty,6);
 assert.equal(JSON.stringify({so,receipt}),before);
});
test('POS rejects repeated returns and accepts only the remaining partial quantity', async t => {
 const pos=require('../controllers/pos.controller');
 const InventoryMovement=require('../models/InventoryMovement');
 const WarehouseStock=require('../models/WarehouseStock');
 const order={...receipt,items:[{...receipt.items[0],priceAtPurchase:100,warehouse:'wh'}],refunds:[],totalAmount:1000,paymentMethod:'cash',save:async()=>{}};
 t.mock.method(Order,'findOne',async()=>order);
 t.mock.method(Order,'countDocuments',async()=>0);
 t.mock.method(Order,'find',()=>chain([order]));
 t.mock.method(SalesOrder,'findOne',()=>chain(so));
 t.mock.method(InventoryMovement,'updateMany',async()=>({}));
 t.mock.method(WarehouseStock,'findOne',()=>{throw new Error('Already-restored stock must not be touched');});
 const submit = quantity => new Promise((resolve,reject)=>{
  pos.refundPOSOrder({body:{items:[{orderItemIndex:0,quantity,restock:false}]},params:{id:'pos'},tenant:{_id:'t'},user:{_id:'staff',role:'admin'}},
    {json(value){resolve(value);},status(){return this;}},reject);
 });
 const rejected=await submit(5);
 assert.equal(rejected.success,false);
 assert.equal(order.refunds.length,0);
 const accepted=await submit(4);
 assert.equal(accepted.success,true);
 assert.equal(order.refunds[0].items[0].salesReturnedQuantity,0);
 assert.equal(service.salesView(so,[order]).items[0].returnedQty,10);
 assert.equal((await submit(1)).success,false);
 assert.equal(order.refunds.length,1);
});
