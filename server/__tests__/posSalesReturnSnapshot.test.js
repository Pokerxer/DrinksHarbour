const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const SalesOrder = require('../models/SalesOrder');
const { projectPOSReturns } = require('../services/linkedReturns.service');
test('a persisted Sales stock return retains its provenance through the Order schema', () => {
 const oid = () => new mongoose.Types.ObjectId();
 const order = new Order({salesReturns:[{repairKey:'SO00008',salesOrder:oid(),reference:'SO00008',recordedAt:new Date(),items:[{orderItemIndex:0,quantity:60,movement:oid(),returnedAt:new Date(),warehouse:oid(),returnedBy:oid()}]}]});
 assert.equal(order.toObject().salesReturns[0].items[0].quantity,60);
 assert.equal(order.toObject().salesReturns[0].repairKey,'SO00008');
});
test('persisted stock return metadata merges into one POS history row', async t => {
 const so={_id:'so',tenant:'t',soNumber:'SO00008',items:[{_id:'line',subproduct:'sp',size:'sz',fulfilledQty:60,returnedQty:60}]};
 const receipt={_id:'pos',tenant:'t',linkedSalesOrder:'so',items:[{subproduct:'sp',size:'sz',quantity:60}],refunds:[],salesReturns:[{salesOrder:'so',reference:'SO00008',returnedAt:new Date('2026-09-28T13:14:43Z'),items:[{orderItemIndex:0,quantity:60}]}]};
 const chain=data=>({select(){return this;},lean:async()=>data});
 t.mock.method(SalesOrder,'find',()=>chain([so]));
 t.mock.method(Order,'find',()=>chain([receipt]));
 const [view]=await projectPOSReturns([receipt],'t');
 assert.equal(view.refunds.length,1);
 assert.equal(view.refunds[0].items[0].quantity,60);
 assert.equal(view.refunds[0].totalRefunded,0);
 assert.deepEqual(view.refunds[0].refundedAt,receipt.salesReturns[0].returnedAt);
 assert.equal(receipt.refunds.length,0);
});
