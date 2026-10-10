const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLinkedReturnState } = require('../services/linkedReturns.helpers');
const so = (returnedQty = 0) => ({_id:'so', tenant:'t', soNumber:'SO00008', items:[{_id:'line',subproduct:'sp',size:'size',fulfilledQty:10,returnedQty}]});
const receipt = (over = {}) => ({_id:'r1',tenant:'t',linkedSalesOrder:'so',receiptNumber:'RCP-1',items:[{subproduct:'sp',size:'size',quantity:10}],refunds:[],...over});

test('Sales return is allocated once to its POS receipt without inventing cash', () => {
  const order=so(10); const receipts=[receipt()]; const before=JSON.stringify({order,receipts});
  const state=buildLinkedReturnState(order,receipts);
  assert.deepEqual(state.salesByReceipt.r1, {0:10});
  assert.equal(JSON.stringify({order,receipts}),before,'projection must never mutate persisted records');
  assert.deepEqual(buildLinkedReturnState(order,receipts),state,'reads are idempotent');
});
test('POS returned quantities appear on the matching Sales line', () => {
  const state=buildLinkedReturnState(so(),[receipt({refunds:[{items:[{orderItemIndex:0,quantity:4,restock:false}],totalRefunded:400}]})]);
  assert.equal(state.posReturnedByLine.line,4);
});
test('Sales return allocation is capped across partial POS receipts', () => {
  const state=buildLinkedReturnState(so(7),[
    receipt({_id:'r2',createdAt:'2026-09-02',items:[{subproduct:'sp',size:'size',quantity:6}]}),
    receipt({_id:'r1',createdAt:'2026-09-01',items:[{subproduct:'sp',size:'size',quantity:4}]}),
  ]);
  assert.deepEqual(state.salesByReceipt,{r1:{0:4},r2:{0:3}});
});
test('a later POS cash refund of Sales-returned goods is not counted twice', () => {
  const state=buildLinkedReturnState(so(6),[receipt({refunds:[{items:[{orderItemIndex:0,quantity:4,salesReturnedQuantity:4}]}]})]);
  assert.equal(state.posReturnedByLine.line || 0,0);
  assert.deepEqual(state.salesByReceipt.r1,{0:6});
});
test('other tenants, other linked orders and mismatched sizes cannot affect returns', () => {
  const foreign=[receipt({tenant:'other'}),receipt({linkedSalesOrder:'other'}),receipt({items:[{subproduct:'sp',size:'other',quantity:10}]})];
  assert.deepEqual(buildLinkedReturnState(so(10),foreign),{posReturnedByLine:{},salesByReceipt:{}});
});
test('unsized SO can match a default-size POS item only when unambiguous', () => {
  const order=so(2); order.items[0].size=null;
  assert.deepEqual(buildLinkedReturnState(order,[receipt()]).salesByReceipt.r1,{0:2});
  order.items.push({...order.items[0],_id:'line2',size:'other'});
  assert.deepEqual(buildLinkedReturnState(order,[receipt()]).salesByReceipt,{});
});

test('cash-after-stock refunds restore only units not already returned in Sales', () => {
  const {refundRestockPlan}=require('../services/linkedReturns.helpers');
  const order=receipt();
  assert.deepEqual(refundRestockPlan(order,0,8,{0:6}),{salesReturnedQuantity:6,restockQuantity:2});
  order.refunds=[{items:[{orderItemIndex:0,quantity:4,salesReturnedQuantity:4}]}];
  assert.deepEqual(refundRestockPlan(order,0,4,{0:6}),{salesReturnedQuantity:2,restockQuantity:2});
});
test('Sales view distinguishes stock-return value from actual POS cash refunds', () => {
  const {salesView}=require('../services/linkedReturns.service');
  const view=salesView(so(2),[receipt({refunds:[{receiptNumber:'RET-1',items:[{orderItemIndex:0,quantity:3}],totalRefunded:300}]})]);
  assert.equal(view.items[0].returnedQty,5);
  assert.equal(view.items[0].salesReturnedQty,2);
  assert.equal(view.items[0].posReturnedQty,3);
  assert.deepEqual(view.returnHistory.map(row=>[row.source,row.quantity,row.refundAmount]),[['sales',2,0],['pos',3,300]]);
});

test('allocation uses chronological Date values, not weekday string sorting', () => {
  const state = buildLinkedReturnState(so(3), [
    receipt({_id:'later',createdAt:new Date('2026-09-28'),items:[{subproduct:'sp',size:'size',quantity:5}]}),
    receipt({_id:'earlier',createdAt:new Date('2026-09-25'),items:[{subproduct:'sp',size:'size',quantity:5}]}),
  ]);
  assert.deepEqual(state.salesByReceipt,{earlier:{0:3}});
});
test('same-request refund rows consume the Sales overlap only once', () => {
  const {refundRestockPlan}=require('../services/linkedReturns.helpers');
  assert.deepEqual(refundRestockPlan(receipt(),0,4,{0:6},[
    {orderItemIndex:0,quantity:4,salesReturnedQuantity:4},
  ]),{salesReturnedQuantity:2,restockQuantity:2});
});
