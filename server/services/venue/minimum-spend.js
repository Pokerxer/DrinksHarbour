'use strict';
const {minor,sum}=require('./money-rules');const {fail}=require('./errors');
function validateMinimumPolicy(policy){
 minor(policy?.minimumMinor??0);if(!policy?.minimumMinor)return;
 if(policy.state!=='approved'||!policy.approvedBy||!policy.approvedAt||!policy.decisionOwner||policy.shortfallClassification!=='service_shortfall'||!policy.minimumTerms||!policy.accounts?.shortfall)fail('MINIMUM_POLICY_REVIEW_REQUIRED','Minimum-spend classification and account require approved policy');
 if(policy.shortfallTaxRate!==0||typeof policy.shortfallTaxDecision!=='string'||!policy.shortfallTaxDecision.trim())fail('SHORTFALL_TAX_REVIEW_REQUIRED','This adapter requires a named, approved zero-tax shortfall decision');
 if(policy.eligibility!=='merchandise_net'||!Array.isArray(policy.excludedSubProducts||[]))fail('MINIMUM_POLICY_REVIEW_REQUIRED','Review eligible consumption and exclusions');
}
function financialLines(acceptedLines,policy=null,acceptedPolicyVersion=null){
 minor(policy?.minimumMinor??0);
 const excluded=new Set((policy?.excludedSubProducts||[]).map(String));
 const eligibleNetMinor=sum(...acceptedLines.filter(l=>!excluded.has(String(l.subproduct))).map(l=>minor(l.netMinor)));
 if(!policy?.minimumMinor)return {eligibleNetMinor,lines:[]};
 validateMinimumPolicy(policy);
 if(acceptedPolicyVersion!==policy.version)fail('FINANCIAL_TERMS_NOT_ACCEPTED','Guest must accept this minimum-spend policy version');
 const amountMinor=Math.max(0,policy.minimumMinor-eligibleNetMinor);
 return {eligibleNetMinor,lines:amountMinor?[{kind:'minimum_shortfall',description:'Minimum spend shortfall',amountMinor,taxMinor:0,account:policy.accounts.shortfall,commercialRateBps:0,policyVersion:policy.version,taxDecision:policy.shortfallTaxDecision}]:[]};
}
module.exports={financialLines,validateMinimumPolicy};
