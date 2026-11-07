'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),jwt=require('jsonwebtoken'),mongoose=require('mongoose');
const {uri,connectVenueMongo,fixture}=require('./helpers/venueMongo');
test('actual market route bundle exposes country UI paths and preserves private enrollment policy and channel authority',{skip:!uri},async t=>{
 await connectVenueMongo(t,'market_mounts');const owner=await fixture(),admin=new mongoose.Types.ObjectId();
 await require('../models/User').collection.insertOne({_id:admin,role:'super_admin',status:'active'});
 await require('../models/CountryConfiguration').collection.insertOne({code:'NG',name:'Nigeria',currency:'NGN',locale:'en-NG',timezones:['Africa/Lagos'],version:1,active:true,capabilities:{marketplace:true,storefront:true,erm:true},readiness:{legal:{evidence:'Private fixture evidence',reviewedBy:admin,reviewedAt:new Date()}}});
 const secret=process.env.JWT_SECRET;process.env.JWT_SECRET='market-mounts-fixture-secret';t.after(()=>secret===undefined?delete process.env.JWT_SECRET:process.env.JWT_SECRET=secret);
 const app=express();app.use(express.json());app.use('/api',require('../routes/market-foundations.routes'));
 app.use((err,req,res,next)=>res.status(err.statusCode||500).json({message:err.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise(resolve=>server.close(resolve)));
 const get=async(path,user)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{headers:user?{Authorization:`Bearer ${jwt.sign({userId:String(user)},process.env.JWT_SECRET)}`}:{}});return {status:response.status,cache:response.headers.get('cache-control'),body:await response.json()};};
 const countries=await get('/countries');assert.equal(countries.status,200);assert.equal(countries.body.data[0].code,'NG');assert.equal(countries.body.data[0].readiness,undefined);
 assert.equal((await get('/countries/admin')).status,401);assert.equal((await get('/countries/admin',owner.actor.userId)).status,403);
 const adminCountries=await get('/countries/admin',admin);assert.equal(adminCountries.status,200);assert.match(adminCountries.cache,/no-store/);
 const mine=await get('/market-enrollments/mine',owner.actor.userId);assert.equal(mine.status,200);assert.deepEqual(mine.body.data,[]);assert.match(mine.cache,/no-store/);
 assert.equal((await get('/market-policies',owner.actor.userId)).status,403);assert.equal((await get('/market-policies',admin)).status,200);
 const channels=await get('/sales-channels',owner.actor.userId);assert.equal(channels.status,200);assert.deepEqual(channels.body.data.channels,[]);assert.match(channels.cache,/no-store/);
});
