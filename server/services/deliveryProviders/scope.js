'use strict';
const crypto=require('node:crypto');
const Child=require('../../models/MerchantOrder'),Order=require('../../models/Order');
const access=require('../merchantFulfillment/access');
const {ConflictError,ValidationError}=require('../../utils/errors');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value){
 if(value===null||typeof value!=='object')return value;
 if(value.toHexString)return value.toHexString();
 if(Array.isArray(value))return value.map(canonical);
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
}
async function load(id,actor,write,session){
 const child=access.assertOwned(await Child.findOne({_id:id,...access.scope(actor,write)}).session(session||null).lean(),actor,write);
 const parent=await Order.findOne({_id:child.order}).session(session||null).lean();
 if(!parent?.user)throw new ConflictError('Saved customer authority required');
 if(parent.shippingMethod!=='pickup'||child.currency!=='NGN'||parent.currency!=='NGN'||child.shippingMinor!==0)throw new ConflictError('Pickup requires saved pickup method and zero shipping allocation');
 const basketHash=hash(canonical(child.lines)),destinationHash=hash(canonical(parent.shippingAddress||{}));
 const snapshot={merchantOrder:child._id,order:child.order,tenant:child.tenant,location:child.location,customer:parent.user,provider:'pickup',currency:child.currency,amountMinor:0,capabilities:['collection_at_origin'],coverage:'origin_location_only',basketHash,destinationHash};
 return {child,snapshot:{...snapshot,scopeHash:hash(canonical(snapshot))}};
}
function provider(value){if(value!=='pickup')throw new ValidationError('Delivery provider unavailable; only local pickup is supported');}
function key(value){if(typeof value!=='string'||!value.trim()||value.length>128)throw new ValidationError('Booking idempotencyKey required (maximum128 characters)');return value;}
module.exports={load,hash,provider,key};
