'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');

const taxPath=require('node:path').resolve(__dirname,'../services/merchantFulfillment/componentRefund/taxRefund.js');
const policyPath=require('node:path').resolve(__dirname,'../services/merchantFulfillment/componentRefund/policy.js');

const TAX_REVIEW='Original tax refund and journal allocation policy requires review.';

async function fixture(t){
  await connectVenueMongo(t,'component_refund_tax');
  const Order=require('../models/Order'),Child=require('../models/MerchantOrder'),Group=require('../models/MerchantOrderSet'),
    Claim=require('../models/MarketplacePaymentClaim'),Journal=require('../models/JournalEntry'),
    Allocation=require('../models/MerchantComponentRefundAllocation');
  const oid=()=>new mongoose.Types.ObjectId();
  const tenant=oid(),buyer=oid(),parent=oid();
  const actor={_id:oid(),role:'super_admin'},foreign={_id:oid(),role:'tenant_owner',tenant:oid()};
  const item={_id:oid(),fulfillmentLineId:oid(),product:oid(),subproduct:oid(),size:oid(),tenant,warehouse:oid(),quantity:3,
    itemSubtotal:10.01,discountAmount:1.0,tenantRevenueShare:7.21,platformCommission:1.8,vendorPriceAtPurchase:2,discountFunding:'platform'};
  const raw={_id:parent,user:buyer,currency:'NGN',subtotal:10.01,discountTotal:1.0,totalAmount:9.91,items:[item],source:'web',
    settlementOwner:'platform',merchantFulfillmentVersion:2,paymentStatus:'paid',shippingFee:0,taxAmount:0.9};
  await Order.collection.insertOne(raw);
  const [allocation]=require('../services/merchantFulfillment/allocation').allocate(raw);
  assert.equal(allocation.taxMinor,90);
  assert.equal(allocation.discountMinor,100);
  const child=await Child.create({...allocation,fulfillmentVersion:2,quantityProgress:[{line:String(item.fulfillmentLineId)}]});
  await Group.create({_id:parent,currency:'NGN',totalMinor:991,children:[child._id],allocationPolicy:'merchandise-weighted-v1'});
  await Claim.create({_id:'stripe:platform:pi_component_tax',provider:'stripe',account:'platform',reference:'pi_component_tax',user:buyer,
    amount:9.91,currency:'NGN',state:'allocated',order:parent,receipt:{method:'stripe',reference:'pi_component_tax',amount:9.91,currency:'NGN'}});
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
  await require('../services/journalEntry.service').postJournalEntry({tenantId:tenant,refDoc:parent,entryType:'sales_revenue',source:'marketplace',
    lines:[{account:'1300',debit:7.21},{account:'6500',debit:1.8},{account:'4000',credit:9.01}]});
  return {Order,Child,Group,Journal,Allocation,child,parent,tenant,actor,foreign,
    policyAuthority:require(policyPath),taxRefund:require(taxPath),
    command:over=>({allocatedMinor:40,idempotencyKey:'tax-1',reason:'Synthetic tax component refund',...over}),
    counters:async()=>({allocations:await Allocation.countDocuments(),journals:await Journal.countDocuments(),
      vatJournals:await Journal.countDocuments({'lines.account':'2100'}),
      child:await Child.findById(child._id).lean(),group:await Group.findById(parent).lean()})};
}

test('tax component refund is fail-closed without a recorded policy, then allocates once-only against one',{skip:!uri},async t=>{
  assert.ok(fs.existsSync(taxPath),'tax component command exists');
  const f=await fixture(t);
  const before=await f.counters();
  // Foreign tenant cannot even see the child: 404, zero writes.
  await assert.rejects(()=>f.taxRefund.allocate(f.child._id,f.command(),f.foreign),{statusCode:404});
  assert.equal(await f.Allocation.countDocuments(),before.allocations);
  // Fail-closed without a recorded tax policy: exact readiness wording, zero writes.
  const error=await (f.taxRefund.allocate(f.child._id,f.command(),f.actor)).then(()=>assert.fail("expected rejection"),(e)=>e);
  assert.equal(error.message,TAX_REVIEW);
  assert.deepEqual(await f.counters(),before);
  // Record a synthetic no-capture reversal policy (super_admin-only, audited).
  const policy=await f.policyAuthority.record(
    {kind:'tax',jurisdiction:'NG-FCT',rateAuthority:'FIRS',bearer:'platform',reversalTreatment:'no_output_vat_captured',decisionReference:'TEST-TAX-1'},
    f.actor);
  assert.equal(policy.version,1);
  const first=await f.taxRefund.allocate(f.child._id,f.command(),f.actor);
  assert.equal(first.status,'allocated');
  assert.equal(first.kind,'tax');
  assert.equal(first.componentMinor,90);
  assert.equal(first.allocatedMinor,40);
  assert.equal(first.remainderMinor,50);
  assert.equal(first.treatment,'no_output_vat_captured');
  assert.equal(first.journalOutcome.state,'no_reverse_required');
  assert.match(first.journalOutcome.reason,/never captured output VAT/);
  assert.equal(first.policy.version,1);
  // Separate gated record: net-merchandise refund semantics, budgets, group
  // and journals untouched; no 2100 journal fabricated.
  const after=await f.counters();
  assert.equal(after.allocations,1);
  assert.equal(after.journals,before.journals);
  assert.equal(after.vatJournals,0);
  assert.equal(after.child.refundReservedMinor,0);
  assert.equal(after.child.refundedMinor,0);
  assert.equal(after.group.refundReservedMinor,0);
  assert.equal(after.group.refundedMinor,0);
  // Sequential replay of the same key: write-free, identical result.
  const replay=await f.taxRefund.allocate(f.child._id,f.command(),f.actor);
  assert.equal(replay.status,'already_allocated');
  assert.equal(replay.allocatedMinor,40);
  assert.equal(await f.Allocation.countDocuments(),1);
  // Concurrent duplicates via real Promise.all: exactly one record.
  const concurrent=f.command({idempotencyKey:'tax-concurrent',allocatedMinor:10});
  const results=await Promise.allSettled([
    f.taxRefund.allocate(f.child._id,concurrent,f.actor),
    f.taxRefund.allocate(f.child._id,concurrent,f.actor)]);
  const statuses=results.map(row=>row.status==='fulfilled'?row.value.status:row.reason.message);
  assert.deepEqual([...statuses].sort(),["allocated","already_allocated"]);
  assert.equal(await f.Allocation.countDocuments({merchantOrder:String(f.child._id),kind:'tax'}),2);
});

test('tax component refund conserves the component and fails closed on journal-reversing treatments',{skip:!uri},async t=>{
  const f=await fixture(t);
  await f.policyAuthority.record(
    {kind:'tax',jurisdiction:'NG-FCT',rateAuthority:'FIRS',bearer:'platform',reversalTreatment:'no_output_vat_captured',decisionReference:'TEST-TAX-2'},
    f.actor);
  // Concurrent different-key commands cannot over-allocate the component.
  const race=await Promise.allSettled([
    f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:60,idempotencyKey:"r1"}),f.actor),
    f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:60,idempotencyKey:"r2"}),f.actor)]);
  const settled=race.map(row=>row.status);
  assert.deepEqual([...settled].sort(),["fulfilled","rejected"]);
  const total=(await require('../models/MerchantComponentRefundRemainder').find({})).reduce((n,row)=>n+row.allocatedMinor,0);
  assert.equal(total,60);
  // Sequential conservation: allocations never exceed the immutable taxMinor.
  const partial=await f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:25,idempotencyKey:"c1"}),f.actor);
  assert.equal(partial.remainderMinor,5);
  const overError=await (f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:60,idempotencyKey:'c2'}),f.actor)).then(()=>assert.fail("expected rejection"),(e)=>e);
  assert.match(overError.message,/exceeds the remaining refundable tax component/);
  const exact=await f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:5,idempotencyKey:'c3'}),f.actor);
  assert.equal(exact.remainderMinor,0);
  await assert.rejects(()=>f.taxRefund.allocate(f.child._id,f.command({allocatedMinor:1,idempotencyKey:'c4'}),f.actor),{statusCode:409});
  // A recorded reversal treatment that requires reversing captured output VAT
  // fails closed: marketplace orders never captured output VAT (no 2100
  // journal exists) and the mechanism never fabricates journals or captures.
  await f.policyAuthority.record(
    {kind:'tax',jurisdiction:'NG-FCT',rateAuthority:'FIRS',bearer:'platform',reversalTreatment:'reverse_captured_output_vat',decisionReference:'TEST-TAX-3'},
    f.actor);
  const before=await f.counters();
  const reverseError=await (f.taxRefund.allocate(f.child._id,f.command({idempotencyKey:'rev-1'}),f.actor)).then(()=>assert.fail("expected rejection"),(e)=>e);
  assert.match(reverseError.message,/no 2100 journal exists to reverse/);
  await f.policyAuthority.record(
    {kind:'tax',jurisdiction:'NG-FCT',rateAuthority:'FIRS',bearer:'platform',reversalTreatment:'retroactive_capture_then_reverse',decisionReference:'TEST-TAX-4'},
    f.actor);
  const retroError=await (f.taxRefund.allocate(f.child._id,f.command({idempotencyKey:'retro-1'}),f.actor)).then(()=>assert.fail("expected rejection"),(e)=>e);
  assert.match(retroError.message,/never fabricates a journal or a retroactive capture/);
  assert.deepEqual(await f.counters(),before);
  // Parent Order.taxAmount consistency before any allocation is recorded.
  await f.Order.collection.updateOne({_id:f.parent},{$set:{taxAmount:1.5}});
  await assert.rejects(
    ()=>f.taxRefund.allocate(f.child._id,f.command({idempotencyKey:'parent-1'}),f.actor),
    /Parent tax component does not reconcile/);
});


// WT-HARDENING (review note N3): the fail-closed tax wording is byte-equal to
// the readiness projection owned by refundReadiness.js.
test('tax fail-closed wording is byte-equal to the readiness projection', { skip: !uri }, async (t) => {
  await connectVenueMongo(t, 'component_refund_tax_wording');
  const readiness = require('../services/merchantFulfillment/refundReadiness');
  const { TAX_REVIEW } = require(taxPath);
  const projection = readiness.project(
    {
    merchandiseMinor: 100,
    refundReservedMinor: 0,
    refundedMinor: 0,
    shippingMinor: 0,
    taxMinor: 90,
    currency: 0,
    currency: 'NGN',
  },
    { provider: 'korapay' },
    '',
  );
  assert.equal(TAX_REVIEW, projection.tax.reason);
});
