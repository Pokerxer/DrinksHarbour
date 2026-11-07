'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose'),crypto=require('node:crypto');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('carrier lifecycle authenticates real HTTP authority and conserves original responsibility', {skip:!uri},async t=>{
 await connectVenueMongo(t,'carrier_life');
 const oid=()=>new mongoose.Types.ObjectId(),tenant=oid(),location=oid(),owner={_id:oid(),role:'tenant_owner',tenant},foreign={_id:oid(),role:'tenant_owner',tenant:oid()},admin={_id:oid(),role:'super_admin'},order=oid();
 await require('../models/User').collection.insertMany([owner,foreign,admin].map(r=>({...r,status:'active'})));
 const Booking=require('../models/MerchantCarrierBooking'),Budget=require('../models/MerchantDispatchBudget'),Review=require('../models/MerchantCarrierReview'),Event=require('../models/MerchantCarrierEvent');
 const old=[process.env.JWT_SECRET,process.env.SHIPBUBBLE_ACCOUNT_SYNTHETIC];process.env.JWT_SECRET='synthetic-carrier-lifecycle';process.env.SHIPBUBBLE_ACCOUNT_SYNTHETIC='sb_sandbox_synthetic';t.after(()=>['JWT_SECRET','SHIPBUBBLE_ACCOUNT_SYNTHETIC'].forEach((k,i)=>old[i]===undefined?delete process.env[k]:process.env[k]=old[i]));
 let status='pending',payment=true,cancelCount=0,trackCount=0;const native=global.fetch;
 t.mock.method(global,'fetch',async(url,options)=>{if(!String(url).startsWith('https://api.shipbubble.com/v1'))return native(url,options);
 assert.equal(options.headers.Authorization,'Bearer sb_sandbox_synthetic');assert.equal(options.redirect,'error');
 if(String(url).includes('/cancel/')){cancelCount++;return new Response(JSON.stringify({status:'success',message:'synthetic cancellation acknowledged'}));}
 trackCount++;return new Response(JSON.stringify({status:'success',data:{results:[{order_id:'SB-LIFE',status,ship_from:{address:'original sender'},ship_to:{address:'original receiver'},...(payment?{payment:{shipping_fee:'50.00',currency:'NGN',status:'completed',type:'wallet'}}:{})}]}}));});
 const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json({verify:(req,res,raw)=>req.rawBody=Buffer.from(raw)}));app.use('/api',require('../routes/merchant-operations.routes'));app.use((e,req,res,next)=>res.status(e.statusCode||500).json({message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 async function call(actor,path,body={},signature){const response=await native(`http://127.0.0.1:${server.address().port}/api/merchant-carrier${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${jwt.sign({userId:String(actor._id)},process.env.JWT_SECRET)}`}:{...signature?{'x-ship-signature':signature}:{}})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
 const id='d'.repeat(64),child='lifecycle-child';
 await Booking.collection.insertOne({_id:id,merchantOrder:child,order,tenant,location,allocationId:'original-allocation',account:'SYNTHETIC',state:'booked',providerId:'SB-LIFE',providerStatus:'pending',scheduledFor:new Date(Date.now()+86400000),rate:{courierId:'1',serviceCode:'regular',amountMinor:5000,displayMinor:6000},snapshot:{codes:[{address:'original sender'},{address:'original receiver'}]},createdBy:owner._id,quote:oid(),review:'synthetic-review',fingerprint:'synthetic-fingerprint',scopeHash:'synthetic-scope'});
 await Budget.create({_id:child,order,tenant,shippingMinor:10000,committedMinor:5000});
 await t.test('tracking is tenant scoped and provider completion never delivers original goods',async()=>{
 assert.equal((await call(foreign,`/bookings/${id}/refresh`)).status,404);assert.equal(trackCount,0);
 status='completed';const result=await call(owner,`/bookings/${id}/refresh`);assert.equal(result.status,200);assert.equal(result.body.data.booking.providerStatus,'completed');assert.equal(result.body.data.booking.state,'booked');
 assert.equal(await require('../models/MerchantShipmentAllocation').countDocuments(),0);assert.equal((await Budget.findById(child)).committedMinor,5000);
 });
 await t.test('unsigned callbacks mutate nothing while valid raw callbacks fetch current status and deduplicate',async()=>{
 const body={order_id:'SB-LIFE',status:'pending'};const before=await Event.countDocuments();let count=trackCount;
 assert.equal((await call(null,'/webhooks/SYNTHETIC',body,'0'.repeat(128))).status,403);assert.equal(await Event.countDocuments(),before);assert.equal(trackCount,count);
 const signature=crypto.createHmac('sha512',process.env.SHIPBUBBLE_ACCOUNT_SYNTHETIC).update(JSON.stringify(body)).digest('hex');
 assert.equal((await call(null,'/webhooks/SYNTHETIC',body,signature)).status,200);assert.equal((await Booking.findById(id)).providerStatus,'completed');assert.equal(trackCount,++count);
 assert.equal((await call(null,'/webhooks/SYNTHETIC',body,signature)).status,200);assert.equal(trackCount,count);
 assert.equal((await call(null,'/webhooks/FOREIGN',body,signature)).status,409);
 });
 await t.test('uncertain reconciliation requires exact known original account address and wallet fee',async()=>{
 await Booking.updateOne({_id:id},{$set:{state:'uncertain',providerStatus:'pending'}});await Budget.updateOne({_id:child},{$set:{reservedMinor:5000,committedMinor:0}});
 assert.equal((await call(owner,`/bookings/${id}/reconcile`)).status,403);
 payment=false;assert.equal((await call(admin,`/bookings/${id}/reconcile`)).status,409);assert.equal((await Booking.findById(id)).state,'uncertain');assert.equal((await Budget.findById(child)).reservedMinor,5000);
 payment=true;status='pending';assert.equal((await call(admin,`/bookings/${id}/reconcile`)).status,200);assert.equal((await Budget.findById(child)).committedMinor,5000);assert.equal((await Budget.findById(child)).reservedMinor,0);
 });
 await t.test('concurrent cancellations never return success for a different operation key and retain committed budget',async()=>{
 const results=await Promise.all([call(owner,`/bookings/${id}/cancel`,{idempotencyKey:'one'}),call(owner,`/bookings/${id}/cancel`,{idempotencyKey:'two'})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(cancelCount,1);assert.equal((await Budget.findById(child)).committedMinor,5000);
 const row=await Booking.findById(id);assert.equal((await call(owner,`/bookings/${id}/cancel`,{idempotencyKey:row.cancelKey})).status,200);assert.equal(cancelCount,1);
 });
 await t.test('review revocation persists actor evidence and an audit record',async()=>{
 const reviewId='e'.repeat(64);await Review.collection.insertOne({_id:reviewId,tenant,location,version:1,status:'reviewed',account:'SYNTHETIC',categoryId:1,maxWeightGrams:100,maxUnits:1,reviewReference:'synthetic-evidence',allowedServices:[{courierId:'1',serviceCode:'regular'}],capabilities:{alcohol:false,fragile:false,ageVerification:false},reviewedBy:admin._id,validUntil:new Date(Date.now()+86400000)});
 const response=await call(admin,`/reviews/${reviewId}/revoke`);assert.equal(response.status,200);
 const row=await Review.findById(reviewId).lean();assert.equal(String(row.revokedBy),String(admin._id));assert.ok(row.revokedAt instanceof Date);
 assert.equal(await require('../models/AuditLog').countDocuments({action:'CARRIER_CAPABILITY_REVOKED',actorUserId:admin._id}),1);
 });
});
