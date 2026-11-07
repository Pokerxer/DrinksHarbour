'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const policy={state:'approved',version:7,approvedBy:'reviewer',approvedAt:new Date(),decisionOwner:'Synthetic finance reviewer',minimumMinor:20000000,minimumTerms:'Minimum eligible discounted merchandise NGN200000; disclosed shortfall is a separate service charge',eligibility:'merchandise_net',excludedSubProducts:[],shortfallClassification:'service_shortfall',shortfallTaxRate:0,shortfallTaxDecision:'synthetic-approved-exemption-v1',accounts:{shortfall:'4050'}};
const lines=[{subproduct:'beverage',netMinor:16000000,taxMinor:0}];
test('minimum spend produces a separately classified financial line with zero merchandise commission',()=>{
 const result=require('../services/venue/minimum-spend').financialLines(lines,policy,7);
 assert.equal(result.eligibleNetMinor,16000000);assert.equal(result.lines[0].amountMinor,4000000);assert.equal(result.lines[0].kind,'minimum_shortfall');assert.equal(result.lines[0].account,'4050');assert.equal(result.lines[0].commercialRateBps,0);assert.equal(result.lines[0].product,undefined);
 assert.equal(require('../services/venue/minimum-spend').financialLines([{...lines[0],netMinor:23000000}],policy,7).lines.length,0);
 assert.throws(()=>require('../services/venue/minimum-spend').financialLines(lines,{...policy,state:'draft'},7),/policy|review/i);
 assert.throws(()=>require('../services/venue/minimum-spend').financialLines(lines,policy,6),/accept|policy/i);
 assert.throws(()=>require('../services/venue/minimum-spend').financialLines(lines,{...policy,shortfallTaxDecision:''},7),/tax|review/i);
});
test('saved canonical invoice discloses the shortfall without a catalogue product or duplicate financial line',()=>{
 const doc={venueIdentityVersion:1,venueBillForSession:'visit',venueBillSnapshot:{acceptedLines:[],financialLines:[{kind:'minimum_shortfall',description:'Minimum spend shortfall',amountMinor:4000000,taxMinor:0,account:'4050'}]},items:[{name:'Beverages',quantity:1,priceAtPurchase:160000,itemSubtotal:160000}],subtotal:160000,totalAmount:200000,currency:'NGN',taxAmount:0};
 const snapshot=require('../services/customerInvoice/snapshot').snapshot('pos',doc);
 assert.equal(snapshot.items.length,2);assert.equal(snapshot.items[1].lineType,'financial_adjustment');assert.equal(snapshot.items[1].product,undefined);assert.equal(snapshot.items.reduce((n,l)=>n+l.lineTotal,0),200000);assert.equal(snapshot.total,200000);
});
test('corrupted minimum amounts fail closed before catalogue billing',()=>{
 for(const minimumMinor of [NaN,-1,0.1,Infinity])assert.throws(()=>require('../services/venue/minimum-spend').financialLines(lines,{...policy,minimumMinor},7),e=>e.code==='INVALID_MONEY');
});
