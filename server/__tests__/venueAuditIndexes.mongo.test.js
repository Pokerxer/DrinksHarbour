'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const mongoose=require('mongoose');const {execFile}=require('node:child_process');const {promisify}=require('node:util');const path=require('node:path');
const {uri,connectVenueMongo}=require('./helpers/venueMongo');
test('audit index CLI previews without writes, converts explicitly and replays safely',{skip:!uri},async t=>{
 await connectVenueMongo(t,'audit_index');const Audit=require('../models/AuditLog');await Audit.createCollection();await Audit.collection.createIndex({timestamp:1},{name:'timestamp_1'});
 const invoke=async flags=>{const result=await promisify(execFile)(process.execPath,[path.resolve(__dirname,'../scripts/prepare-venue-audit-index.js'),...flags],{env:{...process.env,VENUE_INDEX_MONGO_URI:`mongodb://127.0.0.1:29127/${mongoose.connection.name}?replicaSet=venuePhase0`},timeout:20000});return result.stdout;};
 assert.match(await invoke([]),/"mode": "dry-run"/);assert.equal((await Audit.collection.indexes()).find(i=>i.name==='timestamp_1').expireAfterSeconds,undefined);
 await assert.rejects(invoke(['--apply']));
 assert.match(await invoke(['--apply','--retention-and-backup-reviewed']),/"status":"ready"/);
 const before=await Audit.collection.indexes();assert.equal(before.find(i=>i.name==='timestamp_1').expireAfterSeconds,220752000);
 await invoke(['--apply','--retention-and-backup-reviewed']);assert.deepEqual(await Audit.collection.indexes(),before);
});
