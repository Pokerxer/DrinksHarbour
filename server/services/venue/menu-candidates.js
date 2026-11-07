'use strict';
const {loadVenueContext}=require('./context');const {requireId}=require('./errors');const {id}=require('./eligibility');
async function menuCandidates(args){
 await loadVenueContext({...args,action:'experience.manage'});
 if(args.after)requireId(args.after);
 const rows=await require('../../models/SubProduct').find({tenant:args.tenantId,visibleInPOS:{$ne:false},status:{$nin:['discontinued','hidden','archived']},...(args.after?{_id:{$gt:args.after}}:{})}).select('_id product').populate('product','name type catalogKind').sort({_id:1}).limit(51).lean();
 const page=rows.slice(0,50);
 // One batched sizes query instead of one per sub-product (N+1 removed): the
 // 50-product page previously issued 50 sequential Size.find round-trips.
 const sizes=await require('../../models/Size').find({tenant:args.tenantId,subproduct:{$in:page.map(row=>row._id)}}).select('_id subproduct size displayName').sort({_id:1}).lean();
 const sizesBySubproduct=new Map();
 for(const size of sizes){
  const key=String(size.subproduct);
  if(!sizesBySubproduct.has(key))sizesBySubproduct.set(key,[]);
  sizesBySubproduct.get(key).push({id:id(size),name:size.displayName||size.size||'Serving'});
 }
 const items=[];
 for(const sp of page){
  const subproductSizes=sizesBySubproduct.get(String(sp._id))||[];
  if(!sp.product)continue;
  // Venue service eligibility comes from the shared predicate in
  // constants/catalogKind.js (Phase 3 S1, docs/saas/venues/03 §2: kind
  // governs channel) so it cannot drift from pricing.js assertVenueProduct.
  if(!require('../../constants/catalogKind').isVenueServiceProduct(sp.product))continue;
  if(subproductSizes.length)items.push({id:id(sp),name:sp.product.name,sizes:subproductSizes});
 }
 return {items,next:rows.length>50?id(rows[49]):null};
}
module.exports={menuCandidates};
