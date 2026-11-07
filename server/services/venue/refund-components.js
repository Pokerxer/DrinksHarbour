'use strict';
const {minor}=require('./money-rules');const {fail}=require('./errors');
function refundComponents(original,amountMinor,previouslyRefundedMinor){
 const {appliedMinor,taxMinor,financialMinor}=original;
 [appliedMinor,taxMinor,financialMinor,amountMinor,previouslyRefundedMinor].forEach(minor);
 if(taxMinor+financialMinor>appliedMinor)fail('REFUND_SOURCE_REVIEW_REQUIRED','Original refund components exceed their allocation');
 if(!appliedMinor||amountMinor+previouslyRefundedMinor>appliedMinor)fail('REFUND_EXCEEDS_RECEIPT');
 // Partition each cumulative prefix, then subtract prefixes. Financial shares
 // use the post-tax remainder so two rounding carries cannot refund two kobo
 // from a one-kobo refund. The full prefix reproduces every original total.
 const at=value=>{
  const tax=Number(BigInt(value)*BigInt(taxMinor)/BigInt(appliedMinor));
  const remainder=value-tax,denominator=appliedMinor-taxMinor;
  const financial=denominator?Number(BigInt(remainder)*BigInt(financialMinor)/BigInt(denominator)):0;
  return {taxMinor:tax,financialMinor:financial,merchandiseMinor:remainder-financial};
 };
 const before=at(previouslyRefundedMinor),after=at(previouslyRefundedMinor+amountMinor);
 return Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-before[key]]));
}
module.exports={refundComponents};
