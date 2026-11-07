'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('managed accounting authority rejects reversed original sales and manual reversal of domain-owned entries',{skip:!uri},async t=>{
 await connectVenueMongo(t,'merchant_accounting_authority');
 const flags=['MERCHANT_FULFILLMENT_ENABLED','MERCHANT_QUANTITY_FULFILLMENT_ENABLED','MERCHANT_REFUNDS_ENABLED'],before=flags.map(key=>process.env[key]);
 flags.forEach(key=>process.env[key]='true');t.after(()=>flags.forEach((key,index)=>{if(before[index]===undefined)delete process.env[key];else process.env[key]=before[index];}));
 const Journal=require('../models/JournalEntry'),Child=require('../models/MerchantOrder'),Claim=require('../models/MarketplacePaymentClaim'),
   refunds=require('../services/merchantFulfillment/refunds'),units=require('../services/merchantFulfillment/quantity/refunds'),journal=require('../services/journalEntry.service');
 let submits=0;
 t.mock.method(require('../services/merchantFulfillment/refundTransport'),'submit',async row=>({id:'re_accounting_authority_'+ ++submits,status:'succeeded',amount:row.amountMinor,currency:'ngn',payment_intent:row.providerReference,
   metadata:{merchant_refund_allocation:String(row._id),merchant_order:row.merchantOrder,parent_order:String(row.order)}}));
 async function fixture(){
   const f=await require('./helpers/merchantQuantityFixture').fixture({cost:3.336});
   const child=await Child.findOne({order:f.order._id,tenant:f.tenants[0]._id}).lean();
   await Claim.create({_id:`stripe:platform:${f.order.paymentDetails.reference}`,provider:'stripe',account:'platform',reference:f.order.paymentDetails.reference,user:f.order.user,
     amount:f.order.totalAmount,currency:'NGN',state:'allocated',order:f.order._id,receipt:{method:'stripe',reference:f.order.paymentDetails.reference,amount:f.order.totalAmount,currency:'NGN'}});
   const input={lines:[{line:String(child.lines[0].line),ranges:[{start:0,quantity:1}]}],expectedVersion:1,idempotencyKey:'accounting-refund',reason:'Synthetic original accounting proof'};
   return {...f,child,input};
 }
 await t.test('a reversed original sales journal blocks execution before any provider request and new unit reservations',async()=>{
   const f=await fixture(),row=await units.request(f.child._id,f.input,f.admin),original=await Journal.findOne({tenant:f.child.tenant,refDoc:f.order._id,entryType:'sales_revenue'}).lean();
   const swapped=require('../services/accounting.helpers').swapLinesForReversal(original);
   await Journal.create({tenant:f.child.tenant,refDoc:original._id,entryType:'reversal',source:original.source,lines:swapped.lines});
   const count=submits;
   await assert.rejects(()=>refunds.execute(String(row._id),f.admin),{statusCode:409});
   assert.equal(submits,count,'already reversed original cannot authorize external refund');
   assert.equal((await refunds.get(String(row._id),f.admin)).state,'reserved');
   await assert.rejects(()=>units.request(f.child._id,{...f.input,lines:[{line:String(f.child.lines[0].line),ranges:[{start:1,quantity:1}]}],expectedVersion:2,idempotencyKey:'reversed-new'},f.admin),{statusCode:409});
 });
 await t.test('general reversal refuses managed original revenue and cost for both accepted versions',async()=>{
   for(const version of [1,2]){
     process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED=version===2?'true':'false';
     const f=await fixture(),originals=await Journal.find({tenant:f.child.tenant,refDoc:f.order._id,entryType:{$in:['sales_revenue','cogs']}}).lean();
     assert.equal(originals.length,2);
     const attempts=await Promise.allSettled(originals.map(entry=>journal.reverseEntry({tenantId:f.child.tenant,entryId:entry._id,userId:f.admin._id})));
     assert.deepEqual(attempts.map(result=>result.status),['rejected','rejected']);
     attempts.forEach(result=>assert.equal(result.reason.statusCode,409));
     assert.equal(await Journal.countDocuments({tenant:f.child.tenant,entryType:'reversal',refDoc:{$in:originals.map(row=>row._id)}}),0);
   }
   process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED='true';
 });
 await t.test('general reversal refuses successful refund and goods cancellation journals by saved allocation evidence',async()=>{
   process.env.MERCHANT_QUANTITY_FULFILLMENT_ENABLED='true';
   const f=await fixture(),row=await units.request(f.child._id,f.input,f.admin);await refunds.execute(String(row._id),f.admin);
   const current=await Child.findById(f.child._id).lean();
   const cancel=await require('../services/merchantFulfillment/quantity/commands').cancelQuantities(f.child._id,{lines:[{line:f.input.lines[0].line,quantity:1}],expectedVersion:current.version,idempotencyKey:'cancel-refunded'},f.admin);
   const entries=await Journal.find({tenant:f.child.tenant,refDoc:{$in:[row._id,cancel._id]},source:{$in:['merchant_refund','merchant_goods_cancel']}}).lean();assert.equal(entries.length,2);
   const attempts=await Promise.allSettled(entries.map(entry=>journal.reverseEntry({tenantId:f.child.tenant,entryId:entry._id,userId:f.admin._id})));
   assert.deepEqual(attempts.map(result=>result.status),['rejected','rejected']);attempts.forEach(result=>assert.equal(result.reason.statusCode,409));
   assert.equal(await Journal.countDocuments({entryType:'reversal',refDoc:{$in:entries.map(entry=>entry._id)}}),0);
 });
 await t.test('unrelated manual entries remain reversible even with a coincidental source label',async()=>{
   const tenant=new mongoose.Types.ObjectId();await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
   const original=await journal.postJournalEntry({tenantId:tenant,source:'merchant_goods_cancel',lines:[{account:'1200',debit:5},{account:'5000',credit:5}]});
   const reversed=await journal.reverseEntry({tenantId:tenant,entryId:original._id,userId:new mongoose.Types.ObjectId()});
   assert.equal(reversed.entryType,'reversal');assert.equal(reversed.lines.find(line=>line.account==='1200').credit,5);
   assert.equal(String((await journal.reverseEntry({tenantId:tenant,entryId:original._id}))._id),String(reversed._id));
 });
});
