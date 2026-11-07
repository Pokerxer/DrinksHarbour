'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
test('channel assertion binds source destination and exact payload without trusting guest fields',()=>{
 const {verifyChannel}=require('../services/venue/channel');
 const body=JSON.stringify({partySize:2});const issued='1000';const signature=crypto.createHmac('sha256','test-only').update(['direct','lounge','main',issued,body].join('\n')).digest('hex');
 const input={channel:'direct',slug:'lounge',locationSlug:'main',issued,body,signature,secret:'test-only',now:1000000};
 assert.equal(verifyChannel(input),'direct');
 assert.throws(()=>verifyChannel({...input,body:JSON.stringify({partySize:3})}),/channel/i);
 assert.throws(()=>verifyChannel({...input,now:1400000}),/channel/i);
 assert.throws(()=>verifyChannel({...input,channel:'platform'}),/channel/i);
});
