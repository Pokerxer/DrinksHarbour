const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {transaction}=require('../services/salesReservations/transaction');
test('unsupported transactions fail closed with an actionable error and end their session',async t=>{
 let ended=0,writes=0;
 t.mock.method(mongoose,'startSession',async()=>({withTransaction:async()=>{throw Object.assign(new Error('Transaction numbers are only allowed on a replica set'),{code:20});},endSession:async()=>{ended++;}}));
 await assert.rejects(transaction(async()=>{writes++;}),error=>error.statusCode===503&&/transaction-capable database/.test(error.message));
 assert.equal(writes,0);assert.equal(ended,1);
});
