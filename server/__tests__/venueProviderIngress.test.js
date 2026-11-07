'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');const express=require('express');
test('HTTP provider ingress authenticates received bytes and retries verification failures',async t=>{
 const previous=process.env.PAYSTACK_SECRET_KEY;process.env.PAYSTACK_SECRET_KEY='sk_test_disposable_ingress';t.after(()=>{if(previous===undefined)delete process.env.PAYSTACK_SECRET_KEY;else process.env.PAYSTACK_SECRET_KEY=previous;});
 let calls=0;const collection=require('../services/venue/collections');
 t.mock.method(collection,'verifyVenuePayment',async({reference})=>{assert.equal(reference,'dhv-ingress-test');calls++;if(calls===2)throw new Error('Verification temporarily unavailable');});
 const app=express();app.use(express.json({verify:(req,res,buffer)=>{if(req.originalUrl.split('?')[0]==='/api/payments/webhooks/paystack')req.rawBody=buffer;}}));
 app.use('/api/payments',require('../routes/payment.routes'));app.use((err,req,res,next)=>res.status(503).json({message:'Verification pending'}));
 const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const raw='{ "event": "charge.success", "data": { "reference": "dhv-ingress-test", "amount": 100001, "currency": "NGN" } }';
 const signature=crypto.createHmac('sha512',process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');
 const send=(body,sign)=>fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhooks/paystack`,{method:'POST',headers:{'Content-Type':'application/json','x-paystack-signature':sign},body});
 assert.equal((await send(raw,'invalid')).status,401);assert.equal(calls,0);
 assert.equal((await send(JSON.stringify(JSON.parse(raw)),signature)).status,401);assert.equal(calls,0);
 assert.equal((await send(raw,signature)).status,200);assert.equal(calls,1);
 assert.equal((await send(raw,signature)).status,503);assert.equal(calls,2);
 // This proves local wiring only. Financial idempotency is tested with real Mongo separately.
});
