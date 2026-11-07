'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
test('carrier responsibility schemas reject incomplete authority, unsupported states and non-minor money',async()=>{
 const Booking=require('../models/MerchantCarrierBooking'),Quote=require('../models/MerchantCarrierQuote'),Review=require('../models/MerchantCarrierReview');
 await assert.rejects(()=>new Booking({state:'delivered',rate:{amountMinor:-1,displayMinor:1.1}}).validate());
 await assert.rejects(()=>new Quote({rates:[{amountMinor:0.5,displayMinor:-2}]}).validate());
 await assert.rejects(()=>new Review({account:'request-supplied-secret',status:'approved'}).validate());
 for(const [Model,fields] of [[Booking,['merchantOrder','order','tenant','location','allocationId','account','quote','fingerprint','snapshot','rate']],[Quote,['tenant','merchantOrder','allocationId','account','scopeHash','snapshot','requestToken']],[Review,['tenant','location','version','account','allowedServices','capabilities','reviewReference']]])for(const field of fields)assert.equal(Model.schema.path(field).options.immutable,true,`${Model.modelName}.${field} original authority immutable`);
});
