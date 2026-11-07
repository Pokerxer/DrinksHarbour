'use strict';
const crypto=require('node:crypto');
const {ConflictError}=require('../utils/errors');
function canonical(value){
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
}
const requestFingerprint=body=>crypto.createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
async function recover(req){
 const key=req.get('Idempotency-Key'),actor=req.user?._id;
 let saved;
 if(typeof key==='string'&&key.length>0&&key.length<=128){
  const identity=crypto.createHash('sha256').update(`${actor||'guest'}:${key}`).digest('hex');
  saved=await require('../models/OrderCheckoutRequest').findById(identity).lean();
 }
 if(!saved&&actor){
  const details=req.body.paymentDetails,reference=details?.reference||details?.transactionId;
  if(['paystack','stripe','korapay','wallet','gift_card'].includes(details?.method)&&typeof reference==='string')saved=await require('../models/MarketplacePaymentClaim').findOne({_id:`${details.method}:platform:${reference}`,user:actor,state:'allocated'}).lean();
 }
 // Unbound historical requests retain their existing path; never invent backfill evidence.
 if(!saved?.requestFingerprint)return null;
 if(saved.requestFingerprint!==requestFingerprint(req.body))throw new ConflictError('Checkout key already used for a different request');
 const order=await require('../models/Order').findOne({_id:saved.order,user:actor||null});
 if(!order)throw new ConflictError('Saved checkout outcome requires reconciliation');
 return order;
}
function response(order){
 const fields=['_id','orderNumber','status','paymentStatus','subtotal','discountTotal','shippingFee','totalAmount'];
 return {success:true,data:{guestAccessToken:require('./guestOrderProof').issue(order),order:Object.fromEntries(fields.map(key=>[key,order[key]]))}};
}
module.exports={recover,requestFingerprint,response};
