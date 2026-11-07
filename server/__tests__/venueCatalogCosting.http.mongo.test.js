'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');const mongoose=require('mongoose');const {connectVenueMongo,fixture}=require('./helpers/venueMongo');
test('real costing routes enforce JWT grants, foreign scope, no-store and fresh revocation',async t=>{
 await connectVenueMongo(t,'costing_http');const scope=await fixture();const other=await fixture();const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='catalog-costing-local-test';t.after(()=>{if(previous===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous;});
 const app=express();app.use(express.json());app.use('/api/venue-ops',require('../routes/venue-ops.routes'));app.use((error,req,res,next)=>res.status(error.statusCode||500).json({code:error.code,message:error.message}));
 const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/api/venue-ops/locations/${scope.locationId}`;const headers={Authorization:`Bearer ${jwt.sign({userId:scope.actor.userId},process.env.JWT_SECRET,{expiresIn:'1h'})}`,'Content-Type':'application/json','Idempotency-Key':'http-portion'};
 const report='/reports/margins?fromDate=2026-10-01&toDate=2026-10-30&basis=recorded';
 assert.equal((await fetch(base+report)).status,401);assert.equal((await fetch(base+report,{headers})).status,403);
 await require('../models/User').updateOne({_id:scope.actor.userId},{$set:{posPermissions:['pos:sell','venue:profitability_read','venue:servings_write']}});
 const result=await fetch(base+report,{headers});assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.deepEqual((await result.json()).data.rows,[]);
 assert.equal((await fetch(base.replace(scope.locationId,other.locationId)+report,{headers})).status,404);
 assert.equal((await fetch(base+'/reports/margins?fromDate=invalid&toDate=2026-10-30&basis=recorded',{headers})).status,400);
 await require('../models/User').updateOne({_id:scope.actor.userId},{$set:{venueDeniedActions:['profitability.read']}});assert.equal((await fetch(base+report,{headers})).status,403);
 await require('../models/User').updateOne({_id:scope.actor.userId},{$set:{status:'suspended'}});assert.equal((await fetch(base+report,{headers})).status,403);
});
