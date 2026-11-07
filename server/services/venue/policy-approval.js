'use strict';
const mongoose=require('mongoose');const Policy=require('../../models/VenueFinancialPolicy');
const {fail,requireId}=require('./errors');const {id}=require('./eligibility');const {fingerprint}=require('./operations');
const fields=['version','decisionOwner','decisionReference','effectiveFrom','effectiveUntil','currency','depositMinor','paymentWindowSeconds','minimumMinor','cancellationTerms','noShowTerms','excessCreditTerms','refundAuthority','refundFunding','taxTreatment','eligibility','minimumTerms','excludedSubProducts','shortfallClassification','shortfallTaxRate','shortfallTaxDecision','accounts'];
function configuration(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!fields.includes(k)))fail('POLICY_REVIEW_REQUIRED','Use only supported reviewed policy fields',400);
 const config=Object.fromEntries(fields.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));
 if(typeof config.decisionReference!=='string'||!config.decisionReference.trim()||config.decisionReference.length>400)fail('POLICY_REVIEW_REQUIRED','Named decision evidence is required',400);
 for(const key of['effectiveFrom','effectiveUntil'])if(config[key]!==undefined){const date=new Date(config[key]);if(!Number.isFinite(date.getTime()))fail('POLICY_REVIEW_REQUIRED','A valid effective interval is required',400);config[key]=date;}
 if(!config.effectiveFrom||config.effectiveUntil&&config.effectiveUntil<=config.effectiveFrom)fail('POLICY_REVIEW_REQUIRED','A valid effective interval is required',400);
 if(!config.accounts||typeof config.accounts!=='object'||Object.keys(config.accounts).some(k=>!['advance','clearing','shortfall','shortfallTax'].includes(k))||Object.values(config.accounts).some(v=>typeof v!=='string'||!v.trim()||v.length>40))fail('POLICY_ACCOUNT_REVIEW_REQUIRED','Review account codes',400);
 if(config.excludedSubProducts!==undefined&&(!Array.isArray(config.excludedSubProducts)||config.excludedSubProducts.length>1000))fail('POLICY_REVIEW_REQUIRED','Review bounded merchandise exclusions',400);
 for(const value of config.excludedSubProducts||[])requireId(value);
 return config;
}
async function reviewPolicy({tenantId,locationId,reviewerId,config:input,apply=false}){
 requireId(tenantId);requireId(locationId);requireId(reviewerId);const config=configuration(input);
 const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
  const reviewer=await require('../../models/User').exists({_id:reviewerId,role:'super_admin',status:'active'}).session(session);if(!reviewer)fail('POLICY_REVIEW_AUTHORITY_REQUIRED','An active platform reviewer is required',403);
  const tenant=await require('../../models/Tenant').exists({_id:tenantId,status:'approved',isActive:{$ne:false}}).session(session);
  const location=await require('../../models/Warehouse').exists({_id:locationId,tenant:tenantId,isActive:{$ne:false}}).session(session);if(!tenant||!location)fail('NOT_FOUND','Active location not found',404);
  if(config.accounts.advance===config.accounts.clearing||config.minimumMinor&&[config.accounts.advance,config.accounts.clearing].includes(config.accounts.shortfall))fail('POLICY_ACCOUNT_REVIEW_REQUIRED','Different account classifications require distinct codes');
  const candidate={...config,tenant:tenantId,location:locationId,state:'approved',approvedBy:reviewerId,approvedAt:new Date()};require('./financial-policy').validatePolicy(candidate);
  const required=new Map([[config.accounts.advance,'liability'],[config.accounts.clearing,'asset']]);if(config.minimumMinor)required.set(config.accounts.shortfall,'income');
  const accounts=await require('../../models/Account').find({tenant:tenantId,code:{$in:[...required.keys()]},isActive:true}).session(session).lean();
  if([...required].some(([code,type])=>!accounts.some(a=>a.code===code&&a.type===type)))fail('POLICY_ACCOUNT_REVIEW_REQUIRED','Account mappings must exist, be active and have the approved classifications');
  const exclusions=config.excludedSubProducts||[];if(exclusions.length&&await require('../../models/SubProduct').countDocuments({_id:{$in:exclusions},tenant:tenantId}).session(session)!==new Set(exclusions).size)fail('POLICY_REVIEW_REQUIRED','Excluded merchandise must belong to this tenant');
  const policyHash=fingerprint(config),existing=await Policy.findOne({tenant:tenantId,location:locationId,version:config.version}).session(session).lean();
  if(existing&&existing.policyHash!==policyHash)fail('POLICY_VERSION_IMMUTABLE','Existing policy versions cannot be changed; review a new version');
  let indexes=[];try{indexes=await Policy.collection.listIndexes().toArray();}catch(error){if(error.code!==26)throw error;}
  const indexReady=indexes.some(i=>i.unique&&Object.keys(i.key).length===3&&i.key.tenant===1&&i.key.location===1&&i.key.version===1);
  if(apply&&!indexReady)fail('POLICY_INDEX_REVIEW_REQUIRED','Review the policy uniqueness index before approvals');
  const result={indexReady,mode:apply?'apply':'dry-run',tenantId,locationId,version:config.version,policyHash,...(existing?{id:id(existing)}:{})};
  if(!apply||existing)return result;
  const [row]=await Policy.create([{...candidate,policyHash}],{session});
  await require('../../models/AuditLog').create([{actorUserId:reviewerId,actorRole:'super_admin',action:'VENUE_FINANCIAL_POLICY_APPROVED',actionCategory:'create',targetType:'VenueFinancialPolicy',targetId:row._id,targetTenantId:tenantId,changes:{after:{locationId,version:config.version,policyHash,decisionReference:config.decisionReference}}}],{session});
  return {...result,id:id(row)};
 });}finally{await session.endSession();}
}
async function preparePolicyIndexes(){
 const duplicates=await Policy.aggregate([{$group:{_id:{tenant:'$tenant',location:'$location',version:'$version'},count:{$sum:1}}},{$match:{count:{$gt:1}}},{$limit:1}]);
 if(duplicates.length)fail('POLICY_INDEX_REVIEW_REQUIRED','Duplicate policy versions require explicit review');
 await Policy.createIndexes();
}
module.exports={configuration,reviewPolicy,preparePolicyIndexes};
