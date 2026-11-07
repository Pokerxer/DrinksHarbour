'use strict';
const Child=require('../../models/MerchantOrder'),access=require('./access');
const {ValidationError}=require('../../utils/errors');
function integer(value,fallback,max){
 if(value===undefined)return fallback;
 if(typeof value!=='number'&&typeof value!=='string'||!/^\d+$/.test(String(value)))throw new ValidationError('Queue page and limit must be positive integers');
 const number=Number(value);if(!Number.isSafeInteger(number)||number<1||number>max)throw new ValidationError('Queue page or limit exceeds its supported range');return number;
}
function options(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['state','page','limit'].includes(key)))throw new ValidationError('Unsupported merchant queue filters');
 const state=input.state===undefined?'open':input.state;
 const known=Child.schema.path('state').enumValues;
 if(typeof state!=='string'||!['open','closed','all',...known].includes(state))throw new ValidationError('Unknown merchant queue state');
 const filter=state==='all'?{}:state==='open'?{state:{$nin:['delivered','cancelled']}}:state==='closed'?{state:{$in:['delivered','cancelled']}}:{state};
 return {filter,page:integer(input.page,1,10000),limit:integer(input.limit,25,100)};
}
async function page(actor,input={}){
 const scope=access.scope(actor),query=options(input),filter={...scope,...query.filter};
 await access.audit(null,actor,'merchant_orders_list');
 const [total,rows]=await Promise.all([Child.countDocuments(filter),Child.find(filter).sort({createdAt:-1,_id:-1}).skip((query.page-1)*query.limit).limit(query.limit).lean()]);
 return {orders:await require('./reads').views(rows),total,page:query.page,pages:Math.max(1,Math.ceil(total/query.limit)),limit:query.limit};
}
module.exports={page};
