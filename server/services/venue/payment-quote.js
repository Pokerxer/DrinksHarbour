'use strict';
function paymentQuote(booking) {
 const policy=booking.financialPolicy;
 if(!policy)return null;
 return {state:booking.moneyState||'none',policyVersion:policy.version,currency:policy.currency,depositMinor:policy.depositMinor,deadline:booking.depositDeadline?new Date(booking.depositDeadline).toISOString():null,
 minimumMinor:policy.minimumMinor||0,minimumTerms:policy.minimumTerms||'',eligibility:policy.eligibility,excludedSubProductIds:(policy.excludedSubProducts||[]).map(String),shortfallClassification:policy.shortfallClassification||null,shortfallTaxRate:policy.shortfallTaxRate??null,termsAccepted:booking.financialTermsVersion===policy.version,cancellationTerms:policy.cancellationTerms,noShowTerms:policy.noShowTerms,excessCreditTerms:policy.excessCreditTerms,collectionEnabled:process.env.VENUE_MONEY_ENABLED==='true'};
}
async function ownedPaymentSummary(booking) {
 const quote=paymentQuote(booking);if(!quote)return null;
 const receipts=await require('../../models/VenuePaymentReceipt').find({tenant:booking.tenant,booking:booking._id,payer:booking.createdBy,purpose:'venue_deposit'}).select('amountMinor appliedMinor unappliedMinor refundedMinor resolution').lean();
 const total=field=>receipts.reduce((n,r)=>n+Number(r[field]||0),0);
 return {...quote,receivedMinor:total('amountMinor'),appliedCreditMinor:total('appliedMinor'),unappliedCreditMinor:total('unappliedMinor'),refundedMinor:total('refundedMinor'),...(receipts.some(r=>r.resolution!=='none')?{state:'paid_needs_resolution'}:{})};
}
module.exports={paymentQuote,ownedPaymentSummary};
