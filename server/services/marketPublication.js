'use strict';
const context=require('./marketContext');
const {ForbiddenError,NotFoundError}=require('../utils/errors');
async function assertPublication(tenant, product) {
 if(!context.enabled())return;
 if(!product || typeof product.type!=='string')throw new NotFoundError('Authoritative catalogue product unavailable');
 const category=require('./marketIngress').categoryFor(product),tenantId=tenant?._id||tenant;
 const rows=await require('../models/MarketEnrollment').find({tenant:tenantId,category}).select('market channel').lean();
 const scopes=[...new Map(rows.map(row=>[`${row.market}:${row.channel}`,row])).values()];
 for(const row of scopes){
  const result=await require('./marketPolicy').evaluateMarketAccess({tenant:tenantId,market:row.market,category,channel:row.channel});
  if(result.allowed)return;
 }
 throw new ForbiddenError('Online publication requires an effective marketplace or storefront enrollment');
}
async function assertListingChange(tenant, current, changes) {
 if(!context.enabled())return;
 const published=changes.isPublished??current?.isPublished??false;
 const visible=changes.visibleInOnlineStore??current?.visibleInOnlineStore??true;
 const requested=changes.isPublished===true || changes.visibleInOnlineStore===true || changes.status==='active';
 if(!published || !visible || !requested)return;
 const productId=current?.product?._id||current?.product||changes.product?._id||changes.product;
 const product=changes.newProductData && !productId ? changes.newProductData : await require('../models/Product').findOne({_id:productId}).select('_id type').lean();
 await assertPublication(tenant,product);
}
module.exports={assertPublication,assertListingChange};
