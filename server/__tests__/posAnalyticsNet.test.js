const test=require('node:test');const assert=require('node:assert/strict');
const {orderLineNetTotals}=require('../services/posAnalyticsNet.service');
test('partial return reduces only the affected product and allocations reconcile',()=>{
 const o={totalAmount:300,items:[{quantity:2,itemSubtotal:100},{quantity:4,itemSubtotal:200}],refunds:[{source:'sales',items:[{orderItemIndex:0,quantity:1}]}]};
 const lines=orderLineNetTotals(o);assert.equal(lines[0].netSales,50);assert.equal(lines[0].netQuantity,1);assert.equal(lines[1].netSales,200);assert.equal(lines[1].netQuantity,4);
});
test('full cash refund clears net sales and quantity',()=>{
 const o={totalAmount:110,items:[{quantity:2,itemSubtotal:100,taxAmount:10}],refunds:[{totalRefunded:110,items:[{orderItemIndex:0,quantity:2,amount:110}]}]};
 assert.equal(orderLineNetTotals(o)[0].netSales,0);assert.equal(orderLineNetTotals(o)[0].netQuantity,0);
});
test('period summaries include fully/partially refunded orders but exclude holds and voids',()=>{
 const {summarizeNetOrders}=require('../services/posAnalyticsNet.service');
 const result=summarizeNetOrders([
  {totalAmount:100,paymentMethod:'cash',paymentStatus:'refunded',refunds:[{totalRefunded:100}]},
  {totalAmount:200,paymentMethod:'card',paymentStatus:'partially_refunded',refunds:[{totalRefunded:50}]},
  {totalAmount:1000,paymentStatus:'paid',isVoided:true},
  {totalAmount:1000,paymentStatus:'pending',status:'hold'},
 ]);
 assert.equal(result.totalSales,150);assert.equal(result.orderCount,2);assert.equal(result.breakdown.cash.total,0);
});
test('legacy Sales return followed by its cash settlement counts returned quantities once',()=>{
 const o={totalAmount:300,items:[{quantity:2,itemSubtotal:100},{quantity:4,itemSubtotal:200}],refunds:[
  {source:'sales',items:[{orderItemIndex:0,quantity:1}]},
  {totalRefunded:50,items:[{orderItemIndex:0,quantity:1,salesReturnedQuantity:1,amount:50}]}
 ]};
 const lines=orderLineNetTotals(o);
 assert.deepEqual(lines.map(i=>i.netQuantity),[1,4]);
 assert.deepEqual(lines.map(i=>i.netSales),[50,200]);
});

// ── Line-level reconciliation ─────────────────────────────────────────────────
// The sales-details strip shows Gross, Discount and Net Revenue side by side and
// the gap between Gross and Net is labelled "discount". It is not: the server
// also deducts returns from each line's net sales, and nothing reported the
// value of those returns, so the cards could not be made to add up. Sending the
// per-line commercial share and the per-line returned value makes the identity
// exact rather than approximate.
test('each line reports the share and returned value that reconcile to its net sales',()=>{
 const o={totalAmount:300,items:[{quantity:2,itemSubtotal:100},{quantity:4,itemSubtotal:200}],
  refunds:[{totalRefunded:50,items:[{orderItemIndex:0,quantity:1,amount:50}]}]};
 const lines=orderLineNetTotals(o);
 for(const line of lines){
  assert.equal(line.grossShare-line.returnedValue,line.netSales);
 }
});

test('the shares of an unreturned receipt sum back to the order total',()=>{
 const o={totalAmount:300,items:[{quantity:2,itemSubtotal:100},{quantity:4,itemSubtotal:200}]};
 const lines=orderLineNetTotals(o);
 assert.equal(lines.reduce((n,l)=>n+l.grossShare,0),300);
 assert.equal(lines.reduce((n,l)=>n+l.netSales,0),300);
});

test('returned value is never negative and never exceeds the share',()=>{
 const o={totalAmount:110,items:[{quantity:2,itemSubtotal:100,taxAmount:10}],
  refunds:[{totalRefunded:110,items:[{orderItemIndex:0,quantity:2,amount:110}]}]};
 for(const line of orderLineNetTotals(o)){
  assert.ok(line.returnedValue>=0,`returnedValue ${line.returnedValue}`);
  assert.ok(line.returnedValue<=line.grossShare+0.005,`returnedValue ${line.returnedValue} vs share ${line.grossShare}`);
 }
});

test('a gratuity is not a return and never appears in returned value',()=>{
 const o={totalAmount:220,tipAmount:20,items:[{quantity:2,itemSubtotal:200}],
  refunds:[{totalRefunded:0,items:[]}]};
 const lines=orderLineNetTotals(o);
 assert.equal(lines[0].returnedValue,0);
});
