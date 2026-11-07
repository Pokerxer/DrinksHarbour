'use strict';
const { fail } = require('./errors'); const { minor } = require('./money-rules');
function validatePolicy(policy) {
  if (!policy || policy.state !== 'approved' || !Number.isSafeInteger(policy.version) || !policy.approvedBy || !policy.approvedAt || policy.currency !== 'NGN') fail('FINANCIAL_POLICY_REQUIRED', 'Reviewed financial policy required');
  for (const field of ['decisionOwner', 'cancellationTerms', 'noShowTerms', 'excessCreditTerms', 'refundAuthority', 'refundFunding', 'taxTreatment', 'eligibility']) {
    if (typeof policy[field] !== 'string' || !policy[field].trim() || policy[field].length > 3000) fail('FINANCIAL_POLICY_REQUIRED', `Review ${field}`);
  }
  minor(policy.depositMinor); minor(policy.minimumMinor);
  if (!Number.isSafeInteger(policy.paymentWindowSeconds) || policy.paymentWindowSeconds < 60 || policy.paymentWindowSeconds > 86400 || !policy.accounts?.advance || !policy.accounts?.clearing) fail('FINANCIAL_POLICY_REQUIRED', 'Review deadline and account mappings');
  if (policy.eligibility !== 'merchandise_net' || policy.taxTreatment !== 'existing_merchandise' || policy.refundAuthority !== 'owner_review' || policy.refundFunding !== 'original_collection') fail('FINANCIAL_POLICY_UNSUPPORTED', 'This policy requires a separately supported accounting/tax adapter');
  require('./minimum-spend').validateMinimumPolicy(policy);
  require('./service-charge').validateServiceChargePolicy(policy);
  return policy;
}
async function approvedSnapshot({ tenantId, locationId, version, mongoSession = null }) {
  const policy = await require('../../models/VenueFinancialPolicy').findOne({ tenant: tenantId, location: locationId, version, state: 'approved' }).session(mongoSession).lean();
  validatePolicy(policy);
  const now=new Date();if(policy.effectiveFrom&&new Date(policy.effectiveFrom)>now||policy.effectiveUntil&&new Date(policy.effectiveUntil)<=now)fail('FINANCIAL_POLICY_REQUIRED','Policy is outside its reviewed effective interval');
  const reviewer = await require('../../models/User').exists({ _id: policy.approvedBy, role: 'super_admin', status: 'active' }).session(mongoSession);
  if (!reviewer) fail('FINANCIAL_POLICY_REQUIRED', 'Policy approval requires a current platform reviewer');
  return policy;
}
async function moneyIndexesReady() {
  const sameKey=(index,fields)=>Object.keys(index.key).length===fields.length&&fields.every(field=>index.key[field]===1);
  const v1=index=>index.unique&&sameKey(index,['tenant','billOrder'])&&index.partialFilterExpression?.collectionVersion===1&&Object.keys(index.partialFilterExpression).length===1;
  const legacy=index=>index.unique&&sameKey(index,['tenant','billOrder'])&&!index.partialFilterExpression;
  async function read(name){try{return await require(`../../models/${name}`).collection.listIndexes().toArray();}catch(error){if(error.code===26)fail('MONEY_INDEX_REVIEW_REQUIRED','Review the payment index migration before collections');throw error;}}
  const indexes=await read('VenuePaymentAttempt');
  const slot=indexes.some(i=>i.unique&&sameKey(i,['tenant','collectionSlot'])&&i.partialFilterExpression?.collectionSlot?.$type==='string'&&Object.keys(i.partialFilterExpression).length===1);
  const reference=indexes.some(i=>i.unique&&sameKey(i,['reference'])&&!i.partialFilterExpression);
  if(indexes.some(legacy)||!indexes.some(v1)||!slot||!reference)fail('MONEY_INDEX_REVIEW_REQUIRED','Review complete payment uniqueness guards before enabling multiple obligations');
  const allocations=await read('VenuePaymentAllocation');
  const receiptKey=allocations.some(i=>i.unique&&sameKey(i,['tenant','receipt','billOrder','key'])&&!i.partialFilterExpression);
  if(allocations.some(legacy)||!allocations.some(v1)||!receiptKey)fail('MONEY_INDEX_REVIEW_REQUIRED','Review complete allocation uniqueness guards before enabling multiple obligations');
}
async function preflightCollection({tenantId,policy,mongoSession=null}) {
  require('./errors').requireId(tenantId);validatePolicy(policy);
  if(require('./eligibility').id(policy.tenant)!==tenantId)fail('FINANCIAL_POLICY_REQUIRED','Policy belongs to another tenant');
  const tenant=await require('../../models/Tenant').findOne({_id:tenantId}).session(mongoSession).lean();
  if(!tenant||tenant.status!=='approved'||tenant.isActive===false)fail('VENUE_DISABLED','Collection is not available',403);
  if(tenant.venueSettings?.accountingClosedThrough&&new Date()<=new Date(tenant.venueSettings.accountingClosedThrough))fail('ACCOUNTING_PERIOD_CLOSED');
  const mapping=policy.accounts;
  if(mapping.advance===mapping.clearing||policy.minimumMinor&&[mapping.advance,mapping.clearing].includes(mapping.shortfall))fail('COLLECTION_ACCOUNT_REVIEW_REQUIRED','Review distinct account classifications');
  const required=new Map([[mapping.advance,'liability'],[mapping.clearing,'asset']]);if(policy.minimumMinor)required.set(mapping.shortfall,'income');
  if(policy.serviceCharge?.enabled){const revenue=policy.serviceCharge.accounts?.revenue;
    if(!revenue||[mapping.advance,mapping.clearing].includes(revenue))fail('COLLECTION_ACCOUNT_REVIEW_REQUIRED','Review distinct account classifications');
    required.set(revenue,'income');}
  const accounts=await require('../../models/Account').find({tenant:tenantId,code:{$in:[...required.keys()]},isActive:true}).session(mongoSession).lean();
  if([...required].some(([code,type])=>!accounts.some(a=>a.code===code&&a.type===type)))fail('COLLECTION_ACCOUNT_REVIEW_REQUIRED','Review active collection account mappings');
}
module.exports = { validatePolicy, approvedSnapshot, moneyIndexesReady, preflightCollection };
