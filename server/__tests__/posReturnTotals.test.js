const test=require('node:test');const assert=require('node:assert/strict');
const {orderReturnTotals,commercialGross}=require('../services/posReturnTotals.service');
const sale=()=>({totalAmount:1100,items:[{quantity:10,itemSubtotal:1000,taxAmount:100}],refunds:[]});
test('full Sales return reduces commercial sales to zero without inventing cash refund',()=>{
 const order=sale();order.refunds=[{source:'sales',items:[{orderItemIndex:0,quantity:10}],totalRefunded:0}];
 const r=orderReturnTotals(order);assert.equal(r.netSales,0);assert.equal(r.totalRefunds,0);assert.equal(r.netCollections,1100);assert.equal(r.returnStatus,'returned');
});
test('partial returns allocate tax/footer total proportionally',()=>{
 const order=sale();order.totalAmount=990;order.refunds=[{source:'sales',items:[{orderItemIndex:0,quantity:4}]}];
 assert.equal(orderReturnTotals(order).netSales,594);
});
test('cash settlement overlapping Sales return is deducted once',()=>{
 const order=sale();order.refunds=[{source:'sales',items:[{orderItemIndex:0,quantity:4}]},
 {totalRefunded:220,items:[{orderItemIndex:0,quantity:2,salesReturnedQuantity:2,amount:220}]}];
  const r=orderReturnTotals(order);assert.equal(r.netSales,660);assert.equal(r.totalRefunds,220);assert.equal(r.netCollections,880);
});
// A tip is money for the staff and cash rounding is a tender artefact. Neither is
// product income, so neither may inflate commercial sales (see models/Order.js tipAmount).
test('gratuity is excluded from commercial gross but still collected in cash',()=>{
  const order=sale();order.totalAmount=1300;order.tipAmount=200;
  assert.equal(commercialGross(order),1100);
  const r=orderReturnTotals(order);
  assert.equal(r.grossRevenue,1100);
  assert.equal(r.netSales,1100);
  assert.equal(r.netCollections,1300);
  assert.equal(r.totalTips,200);
});
test('cash rounding is excluded from commercial gross but still collected in cash',()=>{
  const order=sale();order.totalAmount=1103;order.roundingAmount=3;
  assert.equal(commercialGross(order),1100);
  const r=orderReturnTotals(order);
  assert.equal(r.netSales,1100);
  assert.equal(r.netCollections,1103);
  assert.equal(r.totalRounding,3);
});
test('a return deducts from commercial sales, not from the tip',()=>{
  const order=sale();order.totalAmount=1300;order.tipAmount=200;
  order.refunds=[{totalRefunded:550,items:[{orderItemIndex:0,quantity:5,amount:550}]}];
  const r=orderReturnTotals(order);
  assert.equal(r.netSales,550);   // 1100 commercial - 550 refunded
  assert.equal(r.netCollections,750); // 1300 tendered - 550 refunded
});
test('a voided receipt is zero commercially and in cash whatever the tip',()=>{
  const order=sale();order.totalAmount=1300;order.tipAmount=200;order.isVoided=true;
  const r=orderReturnTotals(order);
  assert.equal(r.netSales,0);assert.equal(r.netCollections,0);
});
