'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const routing = require('../services/ors.service');
const { shippingQuote } = require('../services/storefrontCart.service');
const tenant = { location: { lat: 9.1, lon: 7.5 } };
const body = { shippingMethod: 'standard', shipping: { state: 'FCT', lga: 'Bwari', coordinates: { latitude: 9.2, longitude: 7.6 } } };
test('REST shipping uses tenant pickup origin and platform road-distance tiers', async t => {
 let origin;
 t.mock.method(routing, 'getRoadDistanceKm', async (lat, lon, from) => { assert.equal(lat,9.2); assert.equal(lon,7.6); origin=from; return 10; });
 const result = await shippingQuote(body,10000,tenant);
 assert.equal(result.fee,4000); assert.equal(result.source,'google'); assert.equal(result.distanceKm,10);
 assert.deepEqual(origin,{lat:9.1,lon:7.5});
});
test('missing pickup coordinates and routing failures return explicit area estimates', async t => {
 let calls=0;
 t.mock.method(routing,'getRoadDistanceKm',async()=>{ calls++; throw new Error('unavailable'); });
 const missing=await shippingQuote(body,10000,{});
 assert.equal(calls,0); assert.equal(missing.source,'zone'); assert.equal(missing.fee,4000);
 const failed=await shippingQuote(body,10000,tenant);
 assert.equal(calls,1); assert.equal(failed.source,'zone'); assert.equal(failed.fee,4000);
});
test('pickup is free without calling routing and invalid distances never produce free delivery',async t=>{
 let calls=0;
 t.mock.method(routing,'getRoadDistanceKm',async()=>{calls++;return NaN;});
 assert.equal((await shippingQuote({shippingMethod:'pickup'},10000,tenant)).fee,0); assert.equal(calls,0);
 const invalid=await shippingQuote(body,10000,tenant); assert.equal(invalid.fee,4000); assert.equal(invalid.source,'zone');
});
test('free-delivery threshold and total metadata remain server authoritative',async t=>{
 t.mock.method(routing,'getRoadDistanceKm',async()=>10);
 const free=await shippingQuote(body,2000000,tenant); assert.equal(free.fee,0); assert.equal(free.isFree,true);
 assert.equal(free.freeThreshold,2000000); assert.equal(free.remaining,0);
 const outside=await shippingQuote({...body,shipping:{...body.shipping,state:'Lagos'}},2000000,tenant);
 assert.equal(outside.fee,4000); assert.equal(outside.freeThreshold,10000000);
});
test('saved tenant street address supplies routing origin when coordinates are missing',async t=>{
 let origin;
 t.mock.method(routing,'getRoadDistanceKm',async(lat,lon,from)=>{origin=from;return 10;});
 const result=await shippingQuote(body,10000,{address:{street:'39 Gana Street',city:'Maitama',state:'Abuja',country:'Nigeria'}});
 assert.equal(result.source,'google');assert.deepEqual(origin,{address:'39 Gana Street, Maitama, Abuja, Nigeria'});
});
