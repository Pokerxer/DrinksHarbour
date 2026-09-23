process.env.JWT_SECRET='price-check-route-test-secret';
process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const router=require('../routes/priceChecker.routes');
const Kiosk=require('../models/PriceCheckerKiosk');
const c=require('../controllers/priceChecker.controller');
const {authenticatePriceChecker}=require('../middleware/priceChecker.middleware');
const {issueSession}=require('../services/priceChecker/session');
const app=express(); app.use(express.json()); app.use('/api/price-checker',router);
app.use((err,req,res,next)=>res.status(err.statusCode||500).json({success:false}));
let server,base;
test.before(async()=>{server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});base=`http://127.0.0.1:${server.address().port}/api/price-checker`;});
test.after(()=>server?.close());
test('anonymous callers cannot read or mutate kiosk management',async()=>{
  for(const [path,method] of [['/kiosks','GET'],['/options','GET'],['/analytics','GET'],['/kiosks','POST'],['/kiosks/'+'a'.repeat(24),'DELETE']]){
    const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
    assert.equal(res.status,401);
  }
});
test('public scans need a purpose-bound session and malformed initialization fails',async()=>{
  assert.equal((await fetch(base+'/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"barcode":"00123"}'})).status,401);
  assert.equal((await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"slug":{"$ne":""}}'})).status,400);
});
test('kiosk session is never accepted as admin authorization',async()=>{
  const token=issueSession({_id:'a'.repeat(24),version:1});
  const res=await fetch(base+'/kiosks',{headers:{Authorization:`Bearer ${token}`}});
  assert.equal(res.status,401);
});
test('management list ignores client tenant and uses JWT tenant',async t=>{
  t.mock.method(Kiosk,'find',filter=>{assert.deepEqual(filter,{tenant:'a'.repeat(24)});return {sort(){return this;},limit(){return this;},lean:async()=>[]};});
  const req={user:{tenant:'a'.repeat(24)},query:{tenant:'b'.repeat(24)}};
  let data;
  await c.list(req,{json:v=>{data=v;} });
  assert.deepEqual(data.data,[]);
});
test('changed kiosk version invalidates an existing session',async t=>{
  const token=issueSession({_id:'a'.repeat(24),version:1});
  t.mock.method(Kiosk,'findOne',filter=>{assert.equal(filter.version,1);return {lean:async()=>null};});
  let error;
  await authenticatePriceChecker({get:()=>token},{},e=>{error=e;});
  assert.equal(error.statusCode,401);
});
