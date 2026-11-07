'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),mongoose=require('mongoose');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('country and channel administration refuse new writes until unique namespace indexes are prepared',{skip:!uri},async t=>{
 await connectVenueMongo(t,'market_index_safety');
 const actor={_id:new mongoose.Types.ObjectId(),role:'super_admin'},Country=require('../models/CountryConfiguration'),Channel=require('../models/SalesChannel');
 await t.test('country namespace cannot create competing records without a unique code',async()=>{
  const country=require('../services/country'),input={code:'GB',name:'Synthetic United Kingdom',currency:'GBP',locale:'en-GB',timezones:['Europe/London'],capabilities:{marketplace:false,storefront:false,erm:true}};
  await assert.rejects(()=>country.createCountry(input,actor,'Synthetic reviewed configuration'),e=>e.code==='COUNTRY_INDEXES_REQUIRED'&&e.statusCode===503);
  assert.equal(await Country.countDocuments(),0);await Country.createIndexes();
  assert.equal((await country.createCountry(input,actor,'Synthetic reviewed configuration')).version,1);
 });
 await t.test('channel code and scoped uniqueness are both required before audited creation',async()=>{
  await Country.collection.insertOne({code:'NG',currency:'NGN',active:true,version:1,capabilities:{erm:true}});
  const tenant=new mongoose.Types.ObjectId();await require('../models/Tenant').collection.insertOne({_id:tenant,status:'approved'});
  const input={reason:'Synthetic reviewed cash channel',configuration:{tenant:String(tenant),code:'SYNTHETIC_POS',kind:'pos',market:'NG',currency:'NGN',active:false,legalOwner:{type:'tenant',reference:String(tenant)},paymentOwner:{type:'tenant',reference:String(tenant),provider:'cash',account:'SYNTHETIC_DRAWER'},pricingPolicy:{code:'SYNTHETIC_RETAIL',version:1,termsReference:'synthetic-only'}}};
  const management=require('../services/salesChannels/management');
  await assert.rejects(()=>management.saveChannel(input,actor),e=>e.code==='CHANNEL_INDEXES_REQUIRED'&&e.statusCode===503);
  assert.equal(await Channel.countDocuments(),0);await Channel.createIndexes();
  assert.equal((await management.saveChannel(input,actor)).version,1);
 });
});
