'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {connectVenueMongo,fixture}=require('./helpers/venueMongo');
test('financial consent pins owned booking version without creating a deposit obligation',async t=>{
 await connectVenueMongo(t,'financial_consent');const args=await fixture();await require('../services/venue/advances').ensureIndexes();
 const customer=new mongoose.Types.ObjectId();await require('../models/User').collection.insertOne({_id:customer,role:'customer',status:'active'});
 const row=await require('../models/Booking').create({tenant:args.tenantId,location:args.locationId,createdBy:customer,guest:{name:'Guest',phone:'123'},partySize:2,bookingAt:new Date(Date.now()+3600000),requestReference:'VR-consent',requestMode:'request_only',status:'confirmed',financialPolicy:{version:7,minimumMinor:20000000}});
 const consent=require('../services/venue/financial-consent');
 const command={customerId:String(customer),reference:row.requestReference,expectedVersion:0,policyVersion:7,acceptedTerms:true,idempotencyKey:'consent'};
 await assert.rejects(consent.accept({...command,acceptedTerms:false}),e=>e.code==='TERMS_ACCEPTANCE_REQUIRED');
 await assert.rejects(consent.accept({...command,policyVersion:6}),e=>e.code==='STATE_CHANGED');
 const one=await consent.accept(command);assert.equal(one.version,1);assert.equal(one.payment.termsAccepted,true);assert.deepEqual(JSON.parse(JSON.stringify(await consent.accept(command))),JSON.parse(JSON.stringify(one)));
 await assert.rejects(consent.accept({...command,customerId:args.actor.userId,idempotencyKey:'foreign'}),e=>e.code==='NOT_FOUND');
 assert.equal(await require('../models/VenuePaymentAttempt').countDocuments(),0);
});
