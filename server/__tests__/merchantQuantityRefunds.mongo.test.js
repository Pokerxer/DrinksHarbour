'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('V2 exact unit refunds reserve and settle original Stripe evidence without changing goods or costs',{skip:!uri},async t=>{
 const target='../services/merchantFulfillment/quantity/refunds';
 const refunds=fs.existsSync(require('node:path').resolve(__dirname,target+'.js'))?require(target):{};
 assert.equal(typeof refunds.request,'function','exact unit refund command exists');
 await connectVenueMongo(t,'merchant_quantity_refunds');
 const oid=()=>new mongoose.Types.ObjectId(),Order=require('../models/Order'),Child=require('../models/MerchantOrder'),Group=require('../models/MerchantOrderSet'),
   Claim=require('../models/MarketplacePaymentClaim'),Journal=require('../models/JournalEntry'),api=require('../services/merchantFulfillment/refunds');
 const actor={_id:oid(),role:'super_admin'},tenant=oid(),buyer=oid(),parent=oid();
 const merchant={_id:oid(),role:'tenant_owner',tenant},foreign={_id:oid(),role:'tenant_owner',tenant:oid()};
 await require('../models/User').collection.insertMany([actor,merchant,foreign].map(user=>({...user,status:'active'})));
 const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='synthetic-unit-refund-http';
 t.after(()=>{if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
 const app=require('express')();app.use(require('express').json());app.use('/',require('../routes/merchant-operations.routes'));
 app.use((error,req,res,next)=>res.status(error.statusCode||500).json({message:error.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const http=async(user,input,id)=>{
   const response=await fetch(`http://127.0.0.1:${server.address().port}/merchant-orders/${id}/quantity-refunds`,{method:'POST',
     headers:{'Content-Type':'application/json',...(user?{Authorization:`Bearer ${require('jsonwebtoken').sign({userId:String(user._id)},process.env.JWT_SECRET)}`}:{})},body:JSON.stringify(input)});
   return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};
 };
 const item={_id:oid(),fulfillmentLineId:oid(),product:oid(),subproduct:oid(),size:oid(),tenant,warehouse:oid(),quantity:3,
   itemSubtotal:10.01,discountAmount:0,tenantRevenueShare:8.68,platformCommission:1.33,vendorPriceAtPurchase:2};
 const raw={_id:parent,user:buyer,currency:'NGN',subtotal:10.01,totalAmount:10.01,items:[item],source:'web',settlementOwner:'platform',
   merchantFulfillmentVersion:2,paymentStatus:'paid',shippingFee:0,taxAmount:0};
 await Order.collection.insertOne(raw);
 const [allocation]=require('../services/merchantFulfillment/allocation').allocate(raw);
 const child=await Child.create({...allocation,fulfillmentVersion:2,quantityProgress:[{line:String(item.fulfillmentLineId)}]});
 await require('../models/OnlineStockReservation').create({_id:'quantity-refund-hold',order:parent,tenant,warehouse:item.warehouse,
   product:item.product,subProduct:item.subproduct,size:item.size,quantity:3,state:'reserved',reservationVersion:2,merchantOrder:child._id,
   fulfillmentLineId:String(item.fulfillmentLineId),consumedQuantity:0,releasedQuantity:0,unitDispositions:[],batchAllocations:[]});
 await Group.create({_id:parent,currency:'NGN',totalMinor:1001,children:[child._id],allocationPolicy:'merchandise-weighted-v1'});
 await Claim.create({_id:'stripe:platform:pi_quantity_refund',provider:'stripe',account:'platform',reference:'pi_quantity_refund',user:buyer,
   amount:10.01,currency:'NGN',state:'allocated',order:parent,receipt:{method:'stripe',reference:'pi_quantity_refund',amount:10.01,currency:'NGN'}});
 await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
 await require('../services/journalEntry.service').postJournalEntry({tenantId:tenant,refDoc:parent,entryType:'sales_revenue',source:'marketplace',
   lines:[{account:'1300',debit:8.68},{account:'6500',debit:1.33},{account:'4000',credit:10.01}]});
 const input={lines:[{line:String(item.fulfillmentLineId),ranges:[{start:1,quantity:1}]}],expectedVersion:1,idempotencyKey:'middle-unit',reason:'Synthetic exact unit refund'};
 const Hold=require('../models/OnlineStockReservation');
 await Hold.updateOne({_id:'quantity-refund-hold'},{$set:{size:oid()}});
 await assert.rejects(()=>refunds.request(child._id,input,actor),{statusCode:409});
 assert.equal(await require('../models/MerchantRefundAllocation').countDocuments({merchantOrder:child._id}),0);
 await Hold.updateOne({_id:'quantity-refund-hold'},{$set:{size:item.size}});
 await Child.updateOne({_id:child._id},{$set:{'quantityProgress.0.shipped':1}});
 await assert.rejects(()=>refunds.request(child._id,input,actor),{statusCode:409},'financial reservation requires consistent owned goods counters');
 await Child.updateOne({_id:child._id},{$set:{'quantityProgress.0.shipped':0}});
 await assert.rejects(()=>api.request(child._id,{amountMinor:334,idempotencyKey:'v1',reason:input.reason},actor),{statusCode:409});
 assert.equal((await http(null,input,child._id)).status,401);
 assert.equal((await http(foreign,input,child._id)).status,404,'JWT tenant cannot reserve sibling units');
 const accepted=await http(merchant,input,child._id);assert.equal(accepted.status,201,JSON.stringify(accepted.body));
 assert.match(accepted.cache,/private.*no-store/);
 const first=accepted.body.data.refund;
 assert.equal(first.provider,undefined);assert.equal(first.receipt,undefined);assert.equal(first.commissionMinor,undefined);
 assert.equal(first.amountMinor,334);assert.equal(first.fulfillmentVersion,2);assert.deepEqual(first.unitRanges[0].ranges.map(({start,quantity})=>({start,quantity})),[{start:1,quantity:1}]);
 assert.equal(String((await refunds.request(child._id,input,actor))._id),String(first._id),'same request survives version increment');
 await assert.rejects(()=>refunds.request(child._id,{...input,reason:'Changed original reason'},actor),{statusCode:409});
 await assert.rejects(()=>refunds.request(child._id,{...input,idempotencyKey:'overlap',expectedVersion:2},actor),{statusCode:409});
 await assert.rejects(()=>refunds.request(child._id,{...input,lines:[{line:String(oid()),ranges:[{start:0,quantity:1}]}],idempotencyKey:'foreign',expectedVersion:2},actor),{statusCode:409});
 let saved=await Child.findById(child._id).lean();assert.equal(saved.version,2);assert.equal(saved.refundReservedMinor,334);
 assert.equal(saved.quantityProgress[0].financialBlocks[0].kind,'reserved');
 const transport=require('../services/merchantFulfillment/refundTransport');let calls=0,result;
 t.mock.method(transport,'submit',async row=>{calls++;result={id:'re_quantity_exact',status:'succeeded',amount:row.amountMinor,currency:'ngn',payment_intent:row.providerReference,
   metadata:{merchant_refund_allocation:String(row._id),merchant_order:row.merchantOrder,parent_order:String(row.order)}};throw Error('Synthetic timeout after provider acceptance');});
 t.mock.method(transport,'fetch',async()=>result);
 const flag=process.env.MERCHANT_REFUNDS_ENABLED;process.env.MERCHANT_REFUNDS_ENABLED='true';t.after(()=>{if(flag===undefined)delete process.env.MERCHANT_REFUNDS_ENABLED;else process.env.MERCHANT_REFUNDS_ENABLED=flag;});
 await assert.rejects(()=>api.execute(String(first._id),actor),/timeout/);
 await assert.rejects(()=>api.execute(String(first._id),actor),/reconcil|resubmit/);assert.equal(calls,1);
 await api.reconcile(String(first._id),actor,result.id);
 await api.reconcile(String(first._id),actor,result.id);
 saved=await Child.findById(child._id).lean();assert.equal(saved.refundReservedMinor,0);assert.equal(saved.refundedMinor,334);assert.equal(saved.version,3);
 assert.equal(saved.quantityProgress[0].financialBlocks[0].kind,'refunded');
 assert.equal(saved.quantityProgress[0].shipped,0);assert.equal(saved.quantityProgress[0].cancelled,0);
 assert.equal(await Journal.countDocuments({source:'merchant_goods_cancel'}),0,'money refund never posts cost or inventory reversal');
 assert.equal(await Journal.countDocuments({refDoc:first._id,entryType:'refund'}),1);
 const remaining={...input,lines:[{line:String(item.fulfillmentLineId),ranges:[{start:0,quantity:1},{start:2,quantity:1}]}],expectedVersion:3,idempotencyKey:'remainder'};
 await Hold.updateOne({_id:'quantity-refund-hold'},{$set:{releasedQuantity:1,unitDispositions:[{start:2,quantity:1,action:'release',allocation:'synthetic-prior-release'}]}});
 await assert.rejects(()=>refunds.request(child._id,remaining,actor),{statusCode:409});
 await Hold.updateOne({_id:'quantity-refund-hold'},{$set:{releasedQuantity:0,consumedQuantity:1,unitDispositions:[{start:0,quantity:1,action:'consume',allocation:'synthetic-shipment'}]}});
 await Child.updateOne({_id:child._id},{$set:{'quantityProgress.0.shipped':1}});
 const second=await refunds.request(child._id,remaining,actor);
 assert.equal(second.amountMinor,667);assert.equal((await Child.findById(child._id)).refundReservedMinor,667);
 const rows=await require('../models/MerchantRefundAllocation').find({merchantOrder:child._id}).lean();
 assert.equal(rows.reduce((n,row)=>n+row.commissionMinor,0),133);assert.equal(rows.reduce((n,row)=>n+row.tenantShareMinor,0),868);
});
