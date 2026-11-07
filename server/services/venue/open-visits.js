'use strict';
const Session=require('../../models/VenueServiceSession');
const {visitContext}=require('./lines');
const {requireId,fail}=require('./errors');
const {id}=require('./eligibility');
async function listOpenVisits({tenantId,actor,after}){
 requireId(tenantId);requireId(id(actor?.userId));if(after)requireId(after);
 if(id(actor?.tenantId)!==tenantId)fail('NOT_FOUND','Tenant not found',404);
 const tenant=await require('../../models/Tenant').findOne({_id:tenantId}).lean();
 if(!tenant||tenant.status!=='approved'||tenant.isActive===false)fail('VENUE_DISABLED','Venue access is not available',403);
 // A bounded candidate page, followed by the same live authority as bill reads.
 const rows=await Session.find({tenant:tenantId,state:{$ne:'closed'},...(after?{_id:{$lt:after}}:{})}).sort({_id:-1}).limit(51).lean();
 const items=[];
 for(const row of rows.slice(0,50)){
  try{
   const context=await visitContext({tenantId,actor,sessionId:id(row),action:'bill.read'});
   const tables=await require('../../models/POSTable').find({_id:{$in:row.tableIds},tenant:tenantId,location:row.location}).select('name').lean();
   items.push({id:id(row),location:context.location.name,tables:tables.map(table=>table.name),openedAt:row.openedAt,timezone:row.timezone,state:row.state});
  }catch(error){if(!['NOT_FOUND','VENUE_PERMISSION_DENIED','SUBSCRIPTION_READ_ONLY','PLAN_UPGRADE_REQUIRED','VENUE_DISABLED','VENUE_NOT_CONFIGURED'].includes(error.code))throw error;}
 }
 return {items,next:rows.length>50?id(rows[49]):null};
}
module.exports={listOpenVisits};
