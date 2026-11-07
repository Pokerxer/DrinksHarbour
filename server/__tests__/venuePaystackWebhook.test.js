'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const axios = require('axios'); const payments = require('../services/payment.service');
test('venue_verifier_preserves_raw_minor_units_and_provider_state', async t => {
  t.mock.method(axios, 'get', async () => ({ data: { status: true, data: { status: 'success', reference: 'dhv-test', id: 123, amount: 100001, currency: 'NGN' } } }));
  const result = await payments.verifyPaystackTransaction('dhv-test');
  assert.equal(result.data.amountMinor, 100001); assert.equal(result.providerStatus, 'success');
  t.mock.method(axios, 'get', async () => ({ data: { status: true, data: { status: 'pending' } } }));
  assert.equal((await payments.verifyPaystackTransaction('dhv-test')).providerStatus, 'pending');
});

test('venue failure inspection retains original provider identity without changing legacy response shape',async t=>{
 t.mock.method(axios,'get',async()=>({data:{status:true,data:{status:'failed',reference:'dhv-failure',id:456,amount:100000,currency:'NGN'}}}));
 assert.equal((await payments.verifyPaystackTransaction('dhv-failure')).data,undefined);
 const inspected=await payments.verifyPaystackTransaction('dhv-failure',{includeFailureIdentity:true});assert.equal(inspected.data.reference,'dhv-failure');assert.equal(inspected.data.amountMinor,100000);assert.equal(inspected.providerStatus,'failed');
});
