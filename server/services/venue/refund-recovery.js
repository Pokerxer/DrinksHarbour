'use strict';
const {requireId}=require('./errors');const {id}=require('./eligibility');
async function recoverRefunds({tenantId,caseIds,apply=false}){
 requireId(tenantId);if(!Array.isArray(caseIds)||!caseIds.length||caseIds.length>100)throw new Error('Provide between one and one hundred exact refund case IDs');for(const value of caseIds)requireId(value);
 const rows=await require('../../models/VenueRefundCase').find({_id:{$in:caseIds},tenant:tenantId}).sort({_id:1}).lean();
 const results=[];
 for(const caseId of caseIds){
  const row=rows.find(r=>id(r)===caseId);if(!row){results.push({caseId,outcome:'not_found'});continue;}
  if(row.state==='processed'){results.push({caseId,outcome:'processed'});continue;}
  if(!row.providerRefundId){results.push({caseId,outcome:'operator_evidence_required'});continue;}
  if(!apply){results.push({caseId,outcome:'would_verify_existing_provider_refund'});continue;}
  try{const result=await require('./refunds').reconcileRefund({tenantId,caseId});results.push({caseId,outcome:result.state});}
  catch(error){results.push({caseId,outcome:error.code==='REFUND_PENDING'?'pending':'review_required',code:typeof error.code==='string'?error.code:'PROVIDER_VERIFICATION_UNAVAILABLE'});}
 }
 return {mode:apply?'apply':'dry-run',tenantId,results};
}
module.exports={recoverRefunds};
