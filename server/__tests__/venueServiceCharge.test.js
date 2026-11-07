'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {serviceChargeLines,validateServiceChargePolicy}=require('../services/venue/service-charge');
const policy={state:'approved',version:7,approvedBy:'reviewer',approvedAt:new Date(),decisionOwner:'Synthetic finance reviewer',
  serviceCharge:{enabled:true,rateBps:1250,appliesTo:'merchandise_net',taxable:true,accounts:{revenue:'4060'},displayLabel:'Service charge 12.5%'}};
const net=25000;
test('disabled_or_absent_service_charge_produces_no_lines',()=>{
  assert.deepEqual(serviceChargeLines(net,null,7,0),[]);
  assert.deepEqual(serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,enabled:false}},7,0),[]);
  assert.deepEqual(serviceChargeLines(0,policy,7,0),[]);
});
test('unapproved_enablement_is_refused_with_the_service_charge_review_code',()=>{
  const bad=patch=>assert.throws(()=>serviceChargeLines(net,{...policy,...patch},7,0),e=>e.code==='SERVICE_CHARGE_POLICY_REVIEW_REQUIRED');
  bad({state:'draft'});bad({approvedBy:undefined});bad({approvedAt:undefined});bad({decisionOwner:undefined});
  bad({serviceCharge:{...policy.serviceCharge,accounts:{}}});
  bad({serviceCharge:{...policy.serviceCharge,displayLabel:''}});
  bad({serviceCharge:{...policy.serviceCharge,displayLabel:'x'.repeat(81)}});
  bad({serviceCharge:{...policy.serviceCharge,appliesTo:'everything'}});
  assert.doesNotThrow(()=>validateServiceChargePolicy({...policy,serviceCharge:{...policy.serviceCharge,taxable:false,taxDecision:'named decision'}}));
});
test('rate_bounds_are_integer_basis_points_from_1_to_5000',()=>{
  for(const rateBps of [0,-1,0.5,5001,NaN,Infinity,'1250'])
    assert.throws(()=>serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,rateBps}},7,0),e=>e.code==='SERVICE_CHARGE_POLICY_REVIEW_REQUIRED',`rate ${rateBps}`);
  assert.equal(serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,rateBps:1}},7,0)[0].amountMinor,3);
  assert.equal(serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,rateBps:5000}},7,0)[0].amountMinor,12500);
});
test('zero_tax_service_charge_requires_a_named_tax_decision_and_carries_it',()=>{
  assert.throws(()=>serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,taxable:false}},7,0),e=>e.code==='SERVICE_CHARGE_POLICY_REVIEW_REQUIRED');
  assert.throws(()=>serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,taxable:false,taxDecision:'   '}},7,0),e=>e.code==='SERVICE_CHARGE_POLICY_REVIEW_REQUIRED');
  const line=serviceChargeLines(net,{...policy,serviceCharge:{...policy.serviceCharge,taxable:false,taxDecision:'approved-zero-rate-v1'}},7,0)[0];
  assert.equal(line.taxMinor,0);assert.equal(line.taxDecision,'approved-zero-rate-v1');
});
test('line_math_is_exact_half_up_at_minor_level_in_both_rounding_directions',()=>{
  const amount=eligible=>serviceChargeLines(eligible,policy,7,0)[0].amountMinor;
  assert.equal(amount(25000),3125);
  assert.equal(amount(25001),3125);assert.equal(amount(25005),3126);
  assert.equal(serviceChargeLines(125,{...policy,serviceCharge:{...policy.serviceCharge,rateBps:1000}},7,0)[0].amountMinor,13);
  const line=serviceChargeLines(25000,policy,7,750)[0];
  assert.equal(line.amountMinor,3125);assert.equal(line.taxMinor,234);
  assert.equal(serviceChargeLines(25004,policy,7,750)[0].taxMinor,234);
  assert.equal(serviceChargeLines(25000,{...policy,serviceCharge:{...policy.serviceCharge,taxable:false,taxDecision:'zero'}},7,750)[0].taxMinor,0);
});
test('consent_gate_matches_the_minimum_spend_discipline',()=>{
  assert.throws(()=>serviceChargeLines(net,policy,6,0),e=>e.code==='FINANCIAL_TERMS_NOT_ACCEPTED');
  const line=serviceChargeLines(net,policy,7,0)[0];
  assert.deepEqual(line,{kind:'service_charge',description:'Service charge 12.5%',amountMinor:3125,taxMinor:0,account:'4060',commercialRateBps:1250,policyVersion:7});
});
test('invalid_eligible_net_fails_closed',()=>{
  for(const eligible of [NaN,-1,0.5,Infinity])assert.throws(()=>serviceChargeLines(eligible,policy,7,0),e=>e.code==='INVALID_MONEY');
});
test('policy_model_defaults_keep_the_feature_zero_change_when_absent',()=>{
  const Model=require('../models/VenueFinancialPolicy');
  const oid=new (require('mongoose').Types.ObjectId)();
  const doc=new Model({tenant:oid,location:oid,version:1,currency:'NGN'});
  assert.equal(doc.serviceCharge?.enabled,false);
  assert.equal(doc.serviceCharge?.countsTowardMinimum,false);
  assert.equal(doc.serviceCharge?.appliesTo,'merchandise_net');
  assert.equal(doc.gratuityAllocation?.mode,'none');
});