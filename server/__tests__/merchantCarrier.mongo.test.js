'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('carrier responsibility uses real saved allocation authority, one POST and conservative uncertain replay', {skip:!uri}, async t=>{
 assert.ok(fs.existsSync(require('node:path').join(__dirname,'../services/deliveryProviders/external/index.js')),'external carrier service implemented');
 await connectVenueMongo(t,'carrier');
 const keys=['MERCHANT_FULFILLMENT_ENABLED','MERCHANT_QUANTITY_FULFILLMENT_ENABLED','MERCHANT_EXTERNAL_CARRIER_ENABLED','JWT_SECRET','SHIPBUBBLE_ACCOUNT_SYNTHETIC'];
 const old=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]=k==='JWT_SECRET'?'carrier-jwt-synthetic':k==='SHIPBUBBLE_ACCOUNT_SYNTHETIC'?'sb_sandbox_synthetic':'true');
 t.after(()=>keys.forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]));
 const f=await require('./helpers/merchantQuantityFixture').fixture({shippingFee:140});
 const Child=require('../models/MerchantOrder'),Order=require('../models/Order'), Allocation=require('../models/MerchantShipmentAllocation');
 const child=await Child.findOne({order:f.order._id,tenant:f.actors[0].tenant}).lean(), actor=f.actors[0];
 await Order.collection.updateOne({_id:f.order._id},{$set:{shippingMethod:'standard','shippingAddress.phone':'+2348000000000'}});
 assert.equal(child.shippingMinor,10000,'real parent shipping charge allocated canonically');
 await require('../models/Warehouse').collection.updateOne({_id:child.location},{$set:{address:{line1:'Synthetic origin',city:'Abuja',state:'FCT',country:'Nigeria'},contact:{name:'Synthetic sender',phone:'+2348000000001',email:'sender@example.test'}}});
 for(const line of child.lines){
 await require('../models/Product').collection.updateOne({_id:line.product},{$set:{type:'soft_drink',isAlcoholic:false}});
 await require('../models/SubProduct').collection.updateOne({_id:line.subproduct},{$set:{shipping:{fragile:false,hazmat:false,requiresAgeVerification:false}}});
 await require('../models/Size').collection.updateOne({_id:line.size},{$set:{shippingWeight:1000,packaging:{type:'plastic_bottle',material:'plastic'}}});
 }
 await require('../services/merchantFulfillment/actions').act(child._id,{action:'accept',expectedVersion:1,idempotencyKey:'carrier-accept'},actor);
 const quantity=require('../services/merchantFulfillment/quantity/commands');
 const shipped=await quantity.shipQuantities(child._id,{lines:[{line:String(child.lines[0].line),quantity:1}],expectedVersion:2,idempotencyKey:'carrier-ship'},actor);
 const allocation=await Allocation.findOne({merchantOrder:child._id}).lean();assert.ok(allocation);
 const service=require('../services/deliveryProviders/external');
 const transport=require('../services/deliveryProviders/external/transport');
 const requests=[];let uncertain=false,display='60.00';
 const native=global.fetch;global.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://api.shipbubble.com/v1'))return native(url,options);
 requests.push({url:String(url),body:options.body&&JSON.parse(options.body)});
 if(String(url).endsWith('/address/validate'))return new Response(JSON.stringify({status:'success',data:{country_code:'NG',address_code:requests.length,formatted_address:JSON.parse(options.body).address}}));
 if(String(url).endsWith('/fetch_rates'))return new Response(JSON.stringify({status:'success',data:{request_token:'synthetic-token',couriers:[{currency:'NGN',service_type:'pickup',courier_id:'1',service_code:'regular',total:'50.00',rate_card_amount:display,courier_name:'Synthetic courier'}]}}));
 if(String(url).endsWith('/labels')){if(uncertain)throw new Error('synthetic timeout');return new Response(JSON.stringify({status:'success',data:{order_id:'SB-SYNTHETIC',status:'pending',ship_from:{address:'Synthetic origin, Abuja, FCT, Nigeria'},ship_to:{address:'Synthetic address, Abuja, FCT, Nigeria'},payment:{shipping_fee:50,currency:'NGN',type:'wallet',status:'completed'}}}));}
 throw new Error('Unexpected synthetic route');
 };t.after(()=>global.fetch=native);
 const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());app.use('/api',require('../routes/merchant-operations.routes'));app.use((e,req,res,next)=>res.status(e.statusCode||500).json({message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function http(who,method,tail,body){const response=await native(`http://127.0.0.1:${server.address().port}/api/merchant-carrier${tail}`,{method,headers:{'Content-Type':'application/json',...(who?{Authorization:`Bearer ${jwt.sign({userId:String(who._id)},process.env.JWT_SECRET)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};}
 assert.equal((await http(null,'GET',`/orders/${child._id}`)).status,401);
 assert.equal((await http(f.actors[1],'GET',`/orders/${child._id}`)).status,404);
 const review={tenant:String(child.tenant),location:String(child.location),version:1,account:'SYNTHETIC',categoryId:1,allowedServices:[{courierId:'1',serviceCode:'regular'}],capabilities:{alcohol:false,ageVerification:false,fragile:false},maxWeightGrams:10000,maxUnits:10,reviewReference:'Synthetic capability evidence only',validUntil:new Date(Date.now()+86400000).toISOString()};
 assert.equal((await http(actor,'POST','/reviews',review)).status,403);
 const reviewed=await http(f.admin,'POST','/reviews',review);assert.equal(reviewed.status,201,JSON.stringify(reviewed.body));
 delete process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED;
 assert.equal((await http(actor,'POST',`/orders/${child._id}/quotes`,{allocationId:allocation._id,dimensions:{length:10,width:10,height:10},pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10)})).status,409);
 assert.equal(requests.length,0);process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED='true';
 const quoteInput={allocationId:allocation._id,dimensions:{length:10,width:10,height:10},pickupDate:new Date(Date.now()+86400000).toISOString().slice(0,10)};

 await t.test('corrupted original allocation order, parent lines and shipping budgets fail before provider calls',async()=>{
 const originalProgress=(await Child.findById(child._id).lean()).quantityProgress;
 const blockedProgress=structuredClone(originalProgress);const blocked=blockedProgress.find(r=>String(r.line)===String(allocation.lines[0].line));blocked.financialBlocks=[{...allocation.lines[0].ranges[0],refund:new (require('mongoose').Types.ObjectId)(),kind:'refunded'}];
 const mutations=[
 [Allocation,{_id:allocation._id},'order',f.actors[1]._id,allocation.order],
 [Allocation,{_id:allocation._id},'lines',[...allocation.lines,...allocation.lines],allocation.lines],
 [Order,{_id:f.order._id},'items.0.product',f.actors[1]._id,f.order.items[0].product],
 [Order,{_id:f.order._id},'channelSnapshot',{kind:'storefront',apiKey:String(f.actors[1]._id)},null],
 [Child,{_id:child._id},'shippingMinor',10001,10000],
 [Child,{_id:child._id},'quantityProgress',blockedProgress,originalProgress],
 ];
 for(const [Model,filter,field,bad,original] of mutations){const before=requests.length;await Model.collection.updateOne(filter,{$set:{[field]:bad}});const response=await http(actor,'POST',`/orders/${child._id}/quotes`,quoteInput);await Model.collection.updateOne(filter,original===null?{$unset:{[field]:''}}:{$set:{[field]:original}});assert.equal(response.status,409,field+': '+JSON.stringify(response.body));assert.equal(requests.length,before,field+' must fail before external HTTP');}
 });
 const quoted=await http(actor,'POST',`/orders/${child._id}/quotes`,quoteInput);assert.equal(quoted.status,201,JSON.stringify(quoted.body));assert.equal(quoted.cache,'private, no-store');
 assert.equal(quoted.body.data.quote.rates[0].amountMinor,5000);assert.ok(!JSON.stringify(quoted.body).includes('synthetic-token'));
 const input={quoteId:quoted.body.data.quote._id,courierId:'1',serviceCode:'regular',idempotencyKey:'carrier-book'};
 const booked=await http(actor,'POST',`/orders/${child._id}/bookings`,input);assert.equal(booked.status,200,JSON.stringify(booked.body));assert.equal(booked.body.data.booking.state,'booked');
 const replay=await http(actor,'POST',`/orders/${child._id}/bookings`,input);assert.equal(replay.body.data.booking._id,booked.body.data.booking._id);assert.equal(requests.filter(r=>r.url.endsWith('/labels')).length,1);
 assert.equal((await Allocation.findById(allocation._id)).state,'shipped');
 assert.equal((await require('../models/MerchantDispatchBudget').findById(child._id)).committedMinor,5000);
 assert.ok(!JSON.stringify(booked.body).includes('account'));
 await assert.rejects(()=>service.bookCarrier(child._id,{...input,idempotencyKey:'another'},actor),/already|responsibility/i);
 const another=await quantity.shipQuantities(child._id,{lines:[{line:String(child.lines[0].line),quantity:1}],expectedVersion:(await Child.findById(child._id)).version,idempotencyKey:'carrier-second-ship'},actor);
 const allocation2=await Allocation.findOne({_id:{$ne:allocation._id},merchantOrder:child._id}).lean();
 // Second responsibility must preserve the first charge rather than rewrite budget evidence.
 display='50.00';
 const q2=await service.quoteCarrier(child._id,{...quoteInput,allocationId:allocation2._id},actor);uncertain=true;
 const concurrent=await Promise.all([service.bookCarrier(child._id,{...input,quoteId:String(q2._id),idempotencyKey:'uncertain'},actor),service.bookCarrier(child._id,{...input,quoteId:String(q2._id),idempotencyKey:'uncertain'},actor)]);const u=concurrent.find(r=>r.state==='uncertain');assert.ok(u);assert.equal(concurrent[0]._id,concurrent[1]._id);
 await service.bookCarrier(child._id,{...input,quoteId:String(q2._id),idempotencyKey:'uncertain'},actor);
 assert.equal(requests.filter(r=>r.url.endsWith('/labels')).length,2);
 const finalBudget=await require('../models/MerchantDispatchBudget').findById(child._id);assert.equal(finalBudget.reservedMinor,5000);assert.equal(finalBudget.committedMinor,5000);assert.equal(finalBudget.reservedMinor+finalBudget.committedMinor,finalBudget.shippingMinor);
 const local=require('../services/deliveryProviders/localDispatch');await local.reviewContract({tenant:String(child.tenant),location:String(child.location),version:1,currency:'NGN',amountMinor:1,maxUnits:10,maxWeightGrams:10000,vehicleTypes:['bike'],coverage:[{country:'Nigeria',state:'FCT',city:'Abuja',minLat:9,maxLat:10,minLon:7,maxLon:8}],capabilities:{alcohol:false,ageVerification:false,fragile:false},reviewReference:'synthetic-shared-budget',validUntil:new Date(Date.now()+86400000).toISOString()},f.admin);
 await Order.collection.updateOne({_id:f.order._id},{$set:{'shippingAddress.coordinates':{latitude:9.5,longitude:7.5}}});process.env.MERCHANT_LOCAL_DISPATCH_ENABLED='true';t.after(()=>delete process.env.MERCHANT_LOCAL_DISPATCH_ENABLED);
 await assert.rejects(()=>local.quoteDispatch(child._id,{lines:[{line:String(child.lines[1].line),quantity:1}]},actor),/shipping allocation/i);
});
