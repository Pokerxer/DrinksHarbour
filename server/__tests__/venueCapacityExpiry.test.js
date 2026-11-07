'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('hold expiry counts committed work once when Mongo retries a transaction callback',async t=>{
 const Claim=require('../models/VenueCapacityClaim'),Booking=require('../models/Booking'),Waitlist=require('../models/VenueWaitlistEntry'),mongoose=require('mongoose');
 const row={_id:'claim',tenant:'tenant',location:'location',booking:'booking',resources:['table'],version:0,save:async()=>{}};
 t.mock.method(Claim,'find',()=>({sort(){return this;},limit(){return this;},select(){return this;},lean:async()=>[row]}));
 t.mock.method(Claim,'findOne',()=>({session:async()=>({...row})}));
 t.mock.method(Booking,'findOne',()=>({session:async()=>null}));
 // E3 additive sweep step: no offered waitlist entry is riding this claim.
 t.mock.method(Waitlist,'findOne',()=>({session:async()=>null}));
 t.mock.method(require('../services/venue/capacity'),'lockTables',async()=>{});
 // The first transaction is rolled back by Mongo. Only the second callback commits.
 t.mock.method(mongoose,'startSession',async()=>({withTransaction:async fn=>{await fn();return fn();},endSession:async()=>{}}));
 assert.deepEqual(await require('../services/venue/capacity-expiry').expireHolds(),{expired:1});
});
