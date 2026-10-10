'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {getRoadDistanceKm,WAREHOUSE}=require('../services/ors.service');
test('road lookup uses explicit tenant origin, bounded timeout and metres to km',async t=>{
 const prior=process.env.GOOGLE_PLACES_API_KEY;process.env.GOOGLE_PLACES_API_KEY='fixture';t.after(()=>{if(prior===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=prior;});
 let url,options;t.mock.method(global,'fetch',async(u,o)=>{url=new URL(u);options=o;return{ok:true,json:async()=>({status:'OK',rows:[{elements:[{status:'OK',distance:{value:12500}}]}]})};});
 assert.equal(await getRoadDistanceKm(9.2,7.6,{lat:9.1,lon:7.5}),12.5);assert.equal(url.searchParams.get('origins'),'9.1,7.5');assert.ok(options.signal);
 await getRoadDistanceKm(9.2,7.6);assert.equal(url.searchParams.get('origins'),`${WAREHOUSE.lat},${WAREHOUSE.lon}`);
});
test('malformed road distance cannot become a zero or negative fee',async t=>{
 const prior=process.env.GOOGLE_PLACES_API_KEY;process.env.GOOGLE_PLACES_API_KEY='fixture';t.after(()=>{if(prior===undefined)delete process.env.GOOGLE_PLACES_API_KEY;else process.env.GOOGLE_PLACES_API_KEY=prior;});
 for(const value of [-1,null,undefined,'100']){t.mock.method(global,'fetch',async()=>({ok:true,json:async()=>({status:'OK',rows:[{elements:[{status:'OK',distance:{value}}]}]})}));await assert.rejects(getRoadDistanceKm(9,7),/Invalid road distance/);}
});
