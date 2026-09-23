const test=require('node:test');
const assert=require('node:assert/strict');
const { reportRange, interestPipeline }=require('../services/priceChecker/analytics');
const { scanRequestId, logScan }=require('../services/priceChecker/scans');
const mongoose=require('mongoose');
const Scan=require('../models/KioskScan');
const Unknown=require('../models/UnknownBarcodeScan');
test('report dates use Lagos midnight and refuse invalid/oversized ranges',()=>{
  const r=reportRange({from:'2026-09-01',to:'2026-09-22'});
  assert.equal(r.start.toISOString(),'2026-08-31T23:00:00.000Z');
  assert.equal(r.end.toISOString(),'2026-09-22T23:00:00.000Z');
  for(const q of [{from:'garbage'},{from:'2026-02-30',to:'2026-03-01'},{from:'2020-01-01',to:'2026-01-01'},{page:'-1'}]) assert.throws(()=>reportRange(q));
});
test('low-stock report joins using tenant, location AND exact size',()=>{
  const pipeline=interestPipeline({tenant:new mongoose.Types.ObjectId()},0,true);
  assert.equal(pipeline[0].$match.tenant instanceof mongoose.Types.ObjectId,true);
  const join=pipeline.find(s=>s.$lookup).$lookup;
  assert.ok(JSON.stringify(join.pipeline).includes('$$tenant'));
  assert.ok(JSON.stringify(join.pipeline).includes('$$location'));
  assert.ok(JSON.stringify(join.pipeline).includes('$$size'));
});
test('scan ids reject objects, malformed or unbounded values',()=>{
  for(const id of [{},'', 'a'.repeat(81)]) assert.throws(()=>scanRequestId(id));
});
test('retries do not increment analytics; transaction writes unknown event and counter together',async t=>{
  let saved=null, count=0;
  t.mock.method(mongoose.connection,'transaction',async fn=>fn({id:'session'}));
  t.mock.method(Scan,'findOne',()=>({session(){return this;},lean:async()=>saved}));
  t.mock.method(Scan,'create',async rows=>{saved=rows[0];});
  t.mock.method(Unknown,'updateOne',async()=>{count++;});
  const context={kiosk:{_id:'a'.repeat(24),tenant:'b'.repeat(24),location:'c'.repeat(24),name:'Counter'}};
  await logScan(context,'00123','request-123456789',{outcome:'UNKNOWN'});
  await logScan(context,'00123','request-123456789',{outcome:'UNKNOWN'});
  assert.equal(count,1); assert.equal(saved.barcode,'00123'); assert.equal(saved.found,false);
  await assert.rejects(logScan(context,'00456','request-123456789',{outcome:'UNKNOWN'}),/already used/);
});
