const test = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const { includeReturnedOrders } = require('../services/salesQuotationReturns');
const chain = rows => ({select(){return this;},lean:async()=>rows});

test('returned selection includes Sales and legacy converted POS returns, excludes unmatched or zero goods', async t => {
  const item = {_id:'line',subproduct:'sp',fulfilledQty:4,returnedQty:0};
  const rows = [
    {_id:'sales',tenant:'mine',items:[{...item,returnedQty:1}]},
    {_id:'converted',tenant:'mine',convertedFrom:'old-quote',items:[item]},
    {_id:'unmatched',tenant:'mine',items:[item]},
    {_id:'zero',tenant:'mine',items:[{...item,fulfilledQty:0,returnedQty:1}]},
  ];
  t.mock.method(Order,'distinct',async (field,q)=>{
    assert.equal(q.tenant,'mine');
    assert.deepEqual(q.refunds,{$elemMatch:{source:{$ne:'sales'},items:{$elemMatch:{quantity:{$gt:0}}}}});
    return ['old-quote','unmatched'];
  });
  t.mock.method(SalesOrder,'find',q=>{
    assert.equal(q.tenant,'mine');
    assert.equal(q.docType,'order');
    assert.deepEqual(q.createdAt,{$gte:'date'});
    assert.deepEqual(q.$and.at(-1).$or[2],{convertedFrom:{$in:['old-quote','unmatched']}});
    return chain(rows);
  });
  t.mock.method(Order,'find',q=>{
    assert.equal(q.tenant,'mine');
    assert.ok(q.linkedSalesOrder.$in.includes('old-quote'));
    return chain([
      {_id:'r1',tenant:'mine',linkedSalesOrder:'old-quote',items:[{subproduct:'sp',quantity:4}],refunds:[{items:[{orderItemIndex:0,quantity:2}]}]},
      {_id:'r2',tenant:'mine',linkedSalesOrder:'unmatched',items:[{subproduct:'other',quantity:4}],refunds:[{items:[{orderItemIndex:0,quantity:2}]}]},
      {_id:'foreign',tenant:'theirs',linkedSalesOrder:'unmatched',items:[{subproduct:'sp',quantity:4}],refunds:[{items:[{orderItemIndex:0,quantity:2}]}]},
    ]);
  });
  const result = await includeReturnedOrders({tenant:'mine',docType:'quotation',createdAt:{$gte:'date'},$and:[{currency:'NGN'}]});
  assert.deepEqual(result.ids,['sales','converted']);
  assert.equal(result.query.tenant,'mine');
  assert.deepEqual(result.query.$and[0],{currency:'NGN'});
});

test('a return quantity without any fulfilled goods cannot include an order', async t => {
  t.mock.method(Order,'distinct',async()=>[]);
  t.mock.method(SalesOrder,'find',()=>chain([{_id:'invalid',tenant:'mine',items:[{returnedQty:2,fulfilledQty:0}]}]));
  const result = await includeReturnedOrders({tenant:'mine',docType:'quotation'});
  assert.deepEqual(result.ids,[]);
});
