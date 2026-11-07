'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
test('public profile projection allowlists content even when stored profile contains legacy internals',()=>{
 const {profileDTO}=require('../services/venue/public-experience');
 const result=profileDTO({tenant:{_id:'tenant',slug:'lounge',name:'Lounge',businessCapabilities:['hospitality']},location:{_id:'location',venueServices:{capabilities:[]}},config:{profileVersion:1,profile:{slug:'main',name:'Main',types:['lounge'],timezone:'Africa/Lagos',description:'Drinks',address:'Abuja',hours:[],exceptions:[],policies:'Request only',costPrice:99,staffIds:['private'],tenant:{id:'forged'}}}});
 assert.equal(result.tenant.id,'tenant');assert.equal(result.costPrice,undefined);assert.equal(result.staffIds,undefined);
});
