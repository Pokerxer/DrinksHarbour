'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');

const discountPath=require('node:path').resolve(__dirname,'../services/merchantFulfillment/componentRefund/discountRefund.js');
const policyPath=require('node:path').resolve(__dirname,'../services/merchantFulfillment/componentRefund/policy.js');

const TENDER_REVIEW='Original tender refund capability requires review.';

async function fixture(t){
  await connectVenueMongo(t,'component_refund_discount');
  const Order=require('../models/Order'),Child=require('../models/MerchantOrder'),Group=require('../models/MerchantOrderSet'),
    Claim=require('../models/MarketplacePaymentClaim'),Journal=require('../models/JournalEntry'),
    Allocation=require('../models/MerchantComponentRefundAllocation');
  const oid=()=>new mongoose.Types.ObjectId();
  const tenant=oid(),buyer=oid(),parent=oid();
  const actor={_id:oid(),role:'super_admin'},foreign={_id:oid(),role:'tenant_owner',tenant:oid()};
  const item={_id:oid(),fulfillmentLineId:oid(),product:oid(),subproduct:oid(),size:oid(),tenant,warehouse:oid(),quantity:3,
    itemSubtotal:10.01,discountAmount:1.0,tenantRevenueShare:7.21,platformCommission:1.8,vendorPriceAtPurchase:2,discountFunding:'platform'};
  const raw={_id:parent,user:buyer,currency:'NGN',subtotal:10.01,discountTotal:1.0,totalAmount:9.01,items:[item],source:'web',
    settlementOwner:'platform',merchantFulfillmentVersion:2,paymentStatus:'paid',shippingFee:0,taxAmount:0};
  await Order.collection.insertOne(raw);
  const [allocation]=require('../services/merchantFulfillment/allocation').allocate(raw);
  assert.equal(allocation.discountMinor,100);
  assert.equal(allocation.taxMinor,0);
  const child=await Child.create({...allocation,fulfillmentVersion:2,quantityProgress:[{line:String(item.fulfillmentLineId)}]});
  await Group.create({_id:parent,currency:'NGN',totalMinor:901,children:[child._id],allocationPolicy:'merchandise-weighted-v1'});
  await Claim.create({_id:'stripe:platform:pi_component_discount',provider:'stripe',account:'platform',reference:'pi_component_discount',user:buyer,
    amount:9.01,currency:'NGN',state:'allocated',order:parent,receipt:{method:'stripe',reference:'pi_component_discount',amount:9.01,currency:'NGN'}});
  await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
  await require('../services/journalEntry.service').postJournalEntry({tenantId:tenant,refDoc:parent,entryType:'sales_revenue',source:'marketplace',
    lines:[{account:'1300',debit:7.21},{account:'6500',debit:1.8},{account:'4000',credit:9.01}]});
  return {Order,Child,Group,Journal,Allocation,child,parent,tenant,actor,foreign,item,
    policyAuthority:require(policyPath),discountRefund:require(discountPath),
    command:over=>({allocatedMinor:60,idempotencyKey:'discount-1',reason:'Synthetic discount component refund',...over}),
    counters:async()=>({allocations:await Allocation.countDocuments(),journals:await Journal.countDocuments(),
      child:await Child.findById(child._id).lean(),group:await Group.findById(parent).lean()})};
}

test('discount component refund is fail-closed without a recorded policy and binds discountFunding eligibility',{skip:!uri},async t=>{
  assert.ok(fs.existsSync(discountPath),'discount component command exists');
  const f=await fixture(t);
  const before=await f.counters();
  // Foreign tenant cannot even see the child: 404, zero writes.
  await assert.rejects(()=>f.discountRefund.allocate(f.child._id,f.command(),f.foreign),{statusCode:404});
  assert.equal(await f.Allocation.countDocuments(),before.allocations);
  // Fail-closed without a recorded discount policy: the exact tender wording.
  const error=await (f.discountRefund.allocate(f.child._id,f.command(),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.equal(error.statusCode,409);
  assert.equal(error.message,TENDER_REVIEW);
  assert.deepEqual(await f.counters(),before);
  // A policy that does not make the recorded funding value eligible fails
  // closed: the parent lines are platform-funded; eligibility is bound to
  // discountFunding per the recorded policy.
  await f.policyAuthority.record(
    {kind:'discount',eligibleFunding:['shared_by_agreement'],platformRecreditPath:'component_record_only',decisionReference:'TEST-DISCOUNT-1'},
    f.actor);
  const ineligible=await (f.discountRefund.allocate(f.child._id,f.command(),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.equal(ineligible.statusCode,409);
  assert.match(ineligible.message,/not eligible under the recorded component refund policy/);
  assert.deepEqual(await f.counters(),before);
  // Eligible policy + executable re-credit path: the allocation records the
  // platform-funded share re-credit as a component outcome only.
  await f.policyAuthority.record(
    {kind:'discount',eligibleFunding:['platform','shared_by_agreement'],platformRecreditPath:'component_record_only',decisionReference:'TEST-DISCOUNT-2'},
    f.actor);
  const first=await f.discountRefund.allocate(f.child._id,f.command(),f.actor);
  assert.equal(first.status,'allocated');
  assert.equal(first.kind,'discount');
  assert.equal(first.componentMinor,100);
  assert.equal(first.allocatedMinor,60);
  assert.equal(first.remainderMinor,40);
  assert.deepEqual(first.fundingValues,['platform']);
  assert.equal(first.recreditOutcome.state,'recorded');
  assert.match(first.recreditOutcome.reason,/no tender or ledger movement/);
  assert.equal(first.policy.version,2);
  // Separate gated record: budgets, group, journals untouched.
  const after=await f.counters();
  assert.equal(after.allocations,1);
  assert.equal(after.journals,before.journals);
  assert.equal(after.child.refundReservedMinor,0);
  assert.equal(after.child.refundedMinor,0);
  assert.equal(after.group.refundReservedMinor,0);
  assert.equal(after.group.refundedMinor,0);
  // Sequential replay: write-free, identical result.
  const replay=await f.discountRefund.allocate(f.child._id,f.command(),f.actor);
  assert.equal(replay.status,'already_allocated');
  assert.equal(replay.allocatedMinor,60);
  assert.equal(await f.Allocation.countDocuments(),1);
  // Concurrent duplicates via real Promise.all: exactly one record.
  const concurrent=f.command({idempotencyKey:'discount-concurrent',allocatedMinor:10});
  const results=await Promise.allSettled([
    f.discountRefund.allocate(f.child._id,concurrent,f.actor),
    f.discountRefund.allocate(f.child._id,concurrent,f.actor)]);
  const statuses=results.map(row=>row.status==='fulfilled'?row.value.status:row.reason.message);
  assert.deepEqual([...statuses].sort(),['allocated','already_allocated']);
  assert.equal(await f.Allocation.countDocuments({merchantOrder:String(f.child._id),kind:'discount'}),2);
});

test('discount component refund conserves the component and enforces the recorded re-credit path',{skip:!uri},async t=>{
  const f=await fixture(t);
  await f.policyAuthority.record(
    {kind:'discount',eligibleFunding:['platform','shared_by_agreement'],platformRecreditPath:'component_record_only',decisionReference:'TEST-DISCOUNT-3'},
    f.actor);
  // Sequential conservation: allocations never exceed the immutable discountMinor.
  const partial=await f.discountRefund.allocate(f.child._id,f.command({allocatedMinor:40,idempotencyKey:'c1'}),f.actor);
  assert.equal(partial.remainderMinor,60);
  const overError=await (f.discountRefund.allocate(f.child._id,f.command({allocatedMinor:70,idempotencyKey:'c2'}),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.equal(overError.statusCode,409);
  assert.match(overError.message,/exceeds the remaining refundable discount component/);
  const exact=await f.discountRefund.allocate(f.child._id,f.command({allocatedMinor:60,idempotencyKey:'c3'}),f.actor);
  assert.equal(exact.remainderMinor,0);
  await assert.rejects(()=>f.discountRefund.allocate(f.child._id,f.command({allocatedMinor:1,idempotencyKey:'c4'}),f.actor),{statusCode:409});
  // A recorded re-credit path that requires money movement fails closed.
  await f.policyAuthority.record(
    {kind:'discount',eligibleFunding:['platform'],platformRecreditPath:'original_tender_recredit',decisionReference:'TEST-DISCOUNT-4'},
    f.actor);
  const pathError=await (f.discountRefund.allocate(f.child._id,f.command({idempotencyKey:'path-1'}),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.equal(pathError.statusCode,409);
  assert.match(pathError.message,/does not execute/);
  // An unrecorded discountFunding source cannot be evaluated: fail closed.
  await f.Order.collection.updateOne({_id:f.parent},{$unset:{'items.0.discountFunding':''}});
  const unrecorded=await (f.discountRefund.allocate(f.child._id,f.command({idempotencyKey:'funding-1'}),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.match(unrecorded.message,/funding source is not recorded/);
  // Parent discount component consistency before any allocation.
  await f.Child.collection.updateOne({_id:f.child._id},{$set:{'lines.0.discountMinor':50}});
  const mismatch=await (f.discountRefund.allocate(f.child._id,f.command({idempotencyKey:'parent-1'}),f.actor)).then(()=>assert.fail('expected rejection'),e=>e);
  assert.match(mismatch.message,/Child discount component does not reconcile/);
  // Zero writes through every fail-closed branch above.
  assert.equal(await f.Allocation.countDocuments(),2);
  assert.equal(await f.Journal.countDocuments(),1);
});


// WT-HARDENING (review note N6): the second recorded funding value is bound
// byte-exactly in both directions.
test('discount component refund binds the shared funding value byte-exactly', { skip: !uri }, async (t) => {
  const f = await fixture(t);
  await f.Order.collection.updateOne({ _id: f.parent }, { $set: { 'items.0.discountFunding': 'shared_by_agreement' } });
  const before = await f.counters();
  // A policy that does not make the recorded funding value eligible fails
  // closed with the byte-exact eligibility wording.
  await f.policyAuthority.record(
    { kind: 'discount', eligibleFunding: ['platform'], platformRecreditPath: 'component_record_only', decisionReference: 'TEST-SBA-EXCLUDE' },
    f.actor,
  );
  const denied = await f.discountRefund.allocate(f.child._id, f.command(), f.actor).then(() => assert.fail('expected rejection'), (e) => e);
  assert.equal(denied.statusCode, 409);
  assert.match(denied.message, new RegExp('not eligible under the recorded component refund policy'));
  assert.deepEqual(await f.counters(), before);
  // A policy that includes the funding value allocates: the outcome records
  // the funding value verbatim and no platform re-credit outcome.
  await f.policyAuthority.record(
    { kind: 'discount', eligibleFunding: ['platform', 'shared_by_agreement'], platformRecreditPath: 'component_record_only', decisionReference: 'TEST-SBA-INCLUDE' },
    f.actor,
  );
  const allocated = await f.discountRefund.allocate(f.child._id, f.command({ idempotencyKey: 'sba-1' }), f.actor);
  assert.equal(allocated.status, 'allocated');
  assert.deepEqual(allocated.fundingValues, ['shared_by_agreement']);
  assert.equal(allocated.recreditOutcome.state, 'not_applicable');
  assert.equal(allocated.policy.version, 2);
  const after = await f.counters();
  assert.equal(after.allocations, 1);
  assert.equal(after.journals, before.journals);
  for (const k of ["refundReservedMinor","refundedMinor"]) assert.equal(after.child[k], 0);
  for (const k of ["refundReservedMinor","refundedMinor"]) assert.equal(after.group[k], 0);
});

// WT-HARDENING (review note N3): the fail-closed tender wording is the
// readiness constant byte-exactly — the constant refundReadiness.js owns.
test('discount fail-closed wording is the readiness constant byte-exactly', { skip: !uri }, async (t) => {
  const f = await fixture(t);
  const readiness = require('../services/merchantFulfillment/refundReadiness');
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
    { provider: 'unknown' },
    '',
  );
  assert.ok(
    Object.values(projection).some((e) => e && e.reason === readiness.TENDER_REVIEW_REASON),
    'the tender wording appears in the readiness projection',
  );
  const error = await f.discountRefund.allocate(f.child._id, f.command(), f.actor).then(() => assert.fail('expected rejection'), (e) => e);
  assert.equal(error.message, readiness.TENDER_REVIEW_REASON);
});
