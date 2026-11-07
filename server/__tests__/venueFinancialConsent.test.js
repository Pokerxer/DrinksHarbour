'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('owned quote discloses minimum eligibility and classification before financial consent without account mappings',()=>{
 const quote=require('../services/venue/payment-quote').paymentQuote({financialTermsVersion:2,financialPolicy:{version:2,currency:'NGN',depositMinor:0,minimumMinor:20000000,minimumTerms:'Net beverages; excluded items do not count',eligibility:'merchandise_net',excludedSubProducts:['excluded'],shortfallClassification:'service_shortfall',shortfallTaxRate:0,shortfallTaxDecision:'Approved exemption',accounts:{shortfall:'private'} }});
 assert.equal(quote.minimumMinor,20000000);assert.equal(quote.minimumTerms,'Net beverages; excluded items do not count');assert.equal(quote.eligibility,'merchandise_net');assert.deepEqual(quote.excludedSubProductIds,['excluded']);assert.equal(quote.shortfallClassification,'service_shortfall');assert.equal(quote.shortfallTaxRate,0);assert.equal(quote.termsAccepted,true);assert.equal(quote.accounts,undefined);
});
