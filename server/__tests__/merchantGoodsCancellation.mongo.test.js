"use strict";
const {test} = require('node:test'), assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {uri,connectVenueMongo} = require('./helpers/venueMongo');
test('paid never-shipped cancellation reverses only original owned COGS once and fails closed before goods release', {skip:!uri}, async t => {
  await connectVenueMongo(t,'merchant_goods_cost');
  const oid=()=>new mongoose.Types.ObjectId(), Order=require('../models/Order'), Child=require('../models/MerchantOrder'),
    Group=require('../models/MerchantOrderSet'), Journal=require('../models/JournalEntry'), Stock=require('../models/WarehouseStock'),
    Hold=require('../models/OnlineStockReservation'), actions=require('../services/merchantFulfillment/actions');
  const actor={_id:oid(),role:'super_admin'}, tenantA=oid(),tenantB=oid();
  async function fixture(costs=[3.335,3.335,9], {missingJournal=false}={}) {
    const parent=oid(), items=costs.map((cost,index)=>({_id:oid(),fulfillmentLineId:oid(),tenant:index<2?tenantA:tenantB,
      warehouse:oid(), product:oid(), subproduct:oid(), size:oid(),quantity:1,priceAtPurchase:20,itemSubtotal:20,
      vendorPriceAtPurchase:cost,tenantRevenueShare:16,platformCommission:4,discountAmount:0}));
    const raw={_id:parent,orderNumber:String(parent),user:oid(),currency:'NGN',subtotal:items.length*20,totalAmount:items.length*20,
      shippingFee:0,taxAmount:0,discountTotal:0,paymentStatus:'refunded',paymentMethod:'card',status:'confirmed',
      settlementOwner:'platform',source:'web',merchantFulfillmentVersion:1,items,
      shippingAddress:{fullName:'Synthetic',email:'buyer@example.test',addressLine1:'Local',city:'Abuja',state:'FCT',country:'Nigeria'}};
    await Order.collection.insertOne(raw);
    const rows=require('../services/merchantFulfillment/allocation').allocate(raw);
    await Child.create(rows.map(row=>({...row,refundedMinor:row.totalMinor})));
    await Group.create({_id:parent,currency:'NGN',totalMinor:raw.totalAmount*100,children:rows.map(row=>row._id),allocationPolicy:'merchandise-weighted-v1'});
    for(const item of items){
      await require('../models/Product').collection.insertOne({_id:item.product,tracksBatch:false});
      await require('../models/SubProduct').collection.insertOne({_id:item.subproduct,tenant:item.tenant,costPrice:9999});
      await Stock.create({tenant:item.tenant,warehouse:item.warehouse,subProduct:item.subproduct,size:item.size,currentQuantity:10,reservedQuantity:0});
    }
    const session=await mongoose.startSession();
    try {await session.withTransaction(()=>require('../services/storefrontLocationStock').reserve(items,parent,session));}finally{await session.endSession();}
    for(const tenant of [tenantA,tenantB])await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
    if(!missingJournal)for(const entry of require('../services/accounting.orders').orderPostings(raw).filter(e=>e.entryType==='cogs'))
      await require('../services/journalEntry.service').postJournalEntry({...entry,refDoc:parent,source:'marketplace'});
    return {parent,items,rows};
  }
  const cancel=(row,key='cancel')=>actions.act(row._id,{action:'cancel',expectedVersion:1,idempotencyKey:key},actor);
  const value=await fixture(), a=value.rows.find(row=>String(row.location)===String(value.items[0].warehouse)),
    b=value.rows.find(row=>String(row.location)===String(value.items[1].warehouse));
  await cancel(a);
  let reversals=await Journal.find({tenant:tenantA,source:'merchant_goods_cancel'}).lean();
  assert.equal(reversals.length,1,'positive original COGS receives a goods-only reversal');
  const cost=reversals[0].lines.find(line=>line.account==='1200').debit;
  assert.ok([3.33,3.34].includes(cost));
  assert.equal(reversals[0].lines.find(line=>line.account==='5000').credit,cost);
  assert.equal(await Journal.countDocuments({tenant:tenantB,source:'merchant_goods_cancel'}),0);
  await cancel(a); assert.equal(await Journal.countDocuments({tenant:tenantA,source:'merchant_goods_cancel'}),1);
  await cancel(b);
  reversals=await Journal.find({tenant:tenantA,source:'merchant_goods_cancel'}).lean();
  assert.equal(Math.round(reversals.reduce((n,row)=>n+row.lines.find(line=>line.account==='1200').debit,0)*100),667,'same-tenant locations reconcile original rounded cost');
  assert.equal(await Hold.countDocuments({order:value.parent,state:'released'}),2);
  assert.equal(await Hold.countDocuments({order:value.parent,state:'reserved'}),1);
  const missing=await fixture([4,5,6],{missingJournal:true});
  await assert.rejects(cancel(missing.rows[0]),{statusCode:409});
  assert.equal(await Hold.countDocuments({order:missing.parent,state:'released'}),0);
  const mismatch=await fixture([4,5,6]);
  await Journal.updateOne({refDoc:mismatch.parent,tenant:tenantA,entryType:'cogs'},{$set:{'lines.0.debit':99,'lines.1.credit':99}});
  await assert.rejects(cancel(mismatch.rows.find(row=>String(row.tenant)===String(tenantA))),{statusCode:409});
  assert.equal(await Hold.countDocuments({order:mismatch.parent,state:'released'}),0);
  const broken=await fixture([4,5,6]), target=broken.rows[0];
  await Stock.updateOne({warehouse:target.location},{$set:{reservedQuantity:0}});
  await assert.rejects(cancel(target),{statusCode:409});
  const brokenRef=new mongoose.Types.ObjectId(require('../services/merchantFulfillment/allocation').hash(`${target._id}:goods-cancel-v1`).slice(0,24));
  assert.equal(await Journal.countDocuments({refDoc:brokenRef,source:'merchant_goods_cancel'}),0);
  assert.equal(await require('../models/MerchantGoodsCancellation').countDocuments({order:broken.parent}),0,'failed stock release rolls back frozen cost evidence too');
  assert.equal((await Child.findById(target._id)).state,'pending');
  const inactive=await fixture([4,5,6]), own=inactive.rows.find(row=>String(row.tenant)===String(tenantA));
  await require('../models/Account').updateOne({tenant:tenantA,code:'1200'},{$set:{isActive:false}});
  await assert.rejects(cancel(own),{statusCode:409});
  assert.equal(await Hold.countDocuments({order:inactive.parent,state:'released'}),0);
  await require('../models/Account').updateOne({tenant:tenantA,code:'1200'},{$set:{isActive:true}});
  const changed=await fixture([4,5,6]), changedA=changed.rows.find(row=>String(row.location)===String(changed.items[0].warehouse)),
    changedB=changed.rows.find(row=>String(row.location)===String(changed.items[1].warehouse));
  await cancel(changedA);
  await Order.collection.updateOne({_id:changed.parent},{$set:{'items.0.vendorPriceAtPurchase':5,'items.1.vendorPriceAtPurchase':4}});
  await assert.rejects(cancel(changedB),{statusCode:409},'unchanged tenant total cannot hide drift of original cost ownership');
  assert.equal(await Hold.countDocuments({order:changed.parent,state:'released'}),1);
  const zero=await fixture([0,0,0],{missingJournal:true});await cancel(zero.rows[0]);
  assert.equal(await Hold.countDocuments({order:zero.parent,state:'released'}),1,'legitimate zero cost remains cancellable');
  const legacy=await fixture([0,0,0],{missingJournal:true});
  await Order.collection.updateOne({_id:legacy.parent},{$unset:{'items.0.vendorPriceAtPurchase':'','items.1.vendorPriceAtPurchase':''}});
  await cancel(legacy.rows.find(row=>String(row.location)===String(legacy.items[0].warehouse)));
  await cancel(legacy.rows.find(row=>String(row.location)===String(legacy.items[1].warehouse)));
  assert.equal(await Hold.countDocuments({order:legacy.parent,state:'released'}),2,'missing legacy zero-cost snapshots with no journal remain compatible');
});
