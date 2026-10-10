const test=require('node:test');
const assert=require('node:assert/strict');
const Order=require('../models/Order');
const {enrichSessionHistory}=require('../services/posSessionHistory.service');
test('history recalculates partial/full refunds by session without changing close snapshots',async t=>{
 t.mock.method(Order,'find',filter=>{
  assert.deepEqual(filter.posSessionId,{$in:['a','b']});
  assert.deepEqual(filter.$or,[{tenant:'t'},{'items.tenant':'t'}]);
  return {lean:async()=>[
   {posSessionId:'a',paymentStatus:'partially_refunded',paymentMethod:'cash',totalAmount:1000,refunds:[{totalRefunded:300}]},
   {posSessionId:'a',paymentStatus:'refunded',paymentMethod:'cash',totalAmount:500,refunds:[{totalRefunded:500}]},
   {posSessionId:'a',paymentStatus:'paid',isVoided:true,totalAmount:9000},
   {posSessionId:'b',paymentStatus:'paid',paymentMethod:'card',totalAmount:200},
  ]};
 });
 const original=[{_id:'a',totalSales:999,status:'closed',closingBalance:55},{_id:'b',totalSales:0}];
 const result=await enrichSessionHistory(original,'t');
 assert.equal(result[0].grossRevenue,1500);
 assert.equal(result[0].totalRefunds,800);
 assert.equal(result[0].totalSales,700);
 assert.equal(result[0].closingBalance,55);
 assert.equal(result[1].totalRefunds,0);
 assert.equal(result[1].totalSales,200);
 assert.equal(original[0].totalSales,999);
});

test('partial Sales stock return value remains separate from monetary refunds',()=>{
 const {salesReturnValue}=require('../services/posSessionHistory.service');
 const {summarizeSessionOrders}=require('../services/posSessionTotals.service');
 const order={paymentStatus:'paid',paymentMethod:'cash',totalAmount:1000,items:[{quantity:10,itemSubtotal:1000}],
  refunds:[{source:'sales',totalRefunded:0,items:[{orderItemIndex:0,quantity:4}]}]};
 assert.equal(salesReturnValue(order),400);
 assert.equal(summarizeSessionOrders([order]).totalRefunds,0);
 assert.equal(summarizeSessionOrders([order]).totalSales,1000);
});

test('session sales deduct both a Sales return and a separate POS refund',async t=>{
 const receipt={posSessionId:'s',paymentStatus:'paid',paymentMethod:'cash',totalAmount:1000,items:[{quantity:10,itemSubtotal:1000}]};
 t.mock.method(Order,'find',()=>({lean:async()=>[
  {...receipt,refunds:[{source:'sales',totalRefunded:0,items:[{orderItemIndex:0,quantity:10}]}]},
  {...receipt,paymentStatus:'refunded',refunds:[{totalRefunded:1000,items:[{orderItemIndex:0,quantity:10,amount:1000}]}]},
 ]}));
 const [session]=await enrichSessionHistory([{_id:'s',totalSales:2000}],'t');
 assert.equal(session.totalSales,0);
 assert.equal(session.returnDeduction,2000);
 assert.equal(session.netCollections,1000);
 assert.equal(session.totalRefunds,1000);
});
