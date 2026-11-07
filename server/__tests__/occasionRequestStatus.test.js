const test=require('node:test'),assert=require('node:assert/strict');
const Request=require('../models/OccasionRequest'),Message=require('../models/OccasionMessage');
const repository=require('../services/occasionRequests/conversationRepository');

// Inclusive-projection stub: lean() removes every field not in the select list.
function thread(t,rows,aggregateRows=[],unreadRows=[]){const capture={projection:null,sort:null,skip:null,limit:null,ownerQuery:null,aggregateCalls:[]};const self={select:projection=>{capture.projection=projection;return self;},sort:sort=>{capture.sort=sort;return self;},skip:n=>{capture.skip=n;return self;},limit:n=>{capture.limit=n;return self;},lean:async()=>rows.map(row=>{const keep=new Set(['_id',...String(capture.projection).split(' ')]);return Object.fromEntries(Object.entries(row).filter(([key])=>keep.has(key)));})};t.mock.method(Request,'find',query=>{capture.ownerQuery=query;return self;});t.mock.method(Request,'countDocuments',async()=>rows.length);t.mock.method(Message,'aggregate',async pipeline=>{capture.aggregateCalls.push(pipeline);return pipeline.at(-1).$group&&'firstStaffReplyAt' in pipeline.at(-1).$group?aggregateRows:unreadRows;});return capture;}
function requestRow(id,overrides={}){return {_id:id,reference:`DH-EVT-${id}`,occasion:'weddings',status:'pending',city:'Abuja',createdAt:new Date('2026-11-06T09:00:00Z'),dueAt:new Date('2026-11-06T09:30:00Z'),lastMessageAt:new Date('2026-11-06T09:00:00Z'),name:'Ada Obi',email:'ada@example.com',whatsapp:'+2348000000000',consentAt:new Date('2026-11-06T08:59:00Z'),draft:'SECRET UNAPPROVED AI DRAFT',submissionKey:'key',fingerprint:'fp',...overrides};}

test('customer request list reports status with the earliest staff reply and no customer PII or drafts',async t=>{
 const rows=[requestRow('r1'),requestRow('r2',{status:'sent'})];
 const capture=thread(t,rows,[{_id:'r2',firstStaffReplyAt:new Date('2026-11-06T09:40:00Z')}]);
 const result=await repository.list('u1');
 assert.deepEqual(capture.ownerQuery,{customer:'u1'});
 assert.match(capture.projection,/reference/);assert.match(capture.projection,/status/);assert.match(capture.projection,/createdAt/);assert.match(capture.projection,/lastMessageAt/);
 for(const field of ['name','email','whatsapp','consentAt','draft','submissionKey','fingerprint','attachment'])assert(!capture.projection.includes(field),field);
 assert.equal(capture.aggregateCalls.length,2,'firstStaffReplies plus the unread aggregate');
 assert.deepEqual(capture.aggregateCalls[0],[{$match:{request:{$in:[rows[0]._id,rows[1]._id]},sender:'staff'}},{$group:{_id:'$request',firstStaffReplyAt:{$min:'$createdAt'}}}]);
 assert.deepEqual(capture.aggregateCalls[1],[
  {$match:{request:{$in:[rows[0]._id,rows[1]._id]},sender:'staff'}},
  {$lookup:{from:Request.collection.name,localField:'request',foreignField:'_id',as:'requestDoc',pipeline:[{$project:{_id:0,lastCustomerReadAt:1}}]}},
  {$project:{request:1,createdAt:1,readAt:{$arrayElemAt:['$requestDoc.lastCustomerReadAt',0]}}},
  {$match:{$expr:{$and:[{$ne:[{$ifNull:['$readAt',null]},null]},{$gt:['$createdAt','$readAt']}]}}},
  {$group:{_id:'$request',customerUnreadCount:{$sum:1}}}]);
 const [waiting,replied]=result.requests;
 assert.equal(waiting.status,'pending');assert.equal(waiting.hasStaffReply,false);assert.equal(waiting.firstStaffReplyAt,null);
 assert.equal(waiting.customerUnreadCount,0,'no unread noise without the read mark');
 assert.equal(waiting.createdAt.getTime(),new Date('2026-11-06T09:00:00Z').getTime());
 assert.equal(waiting.lastMessageAt.getTime(),new Date('2026-11-06T09:00:00Z').getTime());
 assert.equal(replied.status,'sent');assert.equal(replied.hasStaffReply,true);
 assert.equal(replied.firstStaffReplyAt.getTime(),new Date('2026-11-06T09:40:00Z').getTime());
 for(const row of result.requests)for(const field of ['name','email','whatsapp','consentAt','draft','submissionKey','fingerprint','attachment','lastCustomerMessageAt','replyStartedAt'])assert.equal(row[field],undefined,field);
 assert.deepEqual({total:result.total,page:result.page,pages:result.pages},{total:2,page:1,pages:1});
});

test('customer request list skips the staff-reply lookup when the page is empty',async t=>{
 const capture=thread(t,[]);
 const result=await repository.list('u1',{page:'3'});
 assert.deepEqual(capture.ownerQuery,{customer:'u1'});
 assert.equal(capture.aggregateCalls.length,0);
 assert.deepEqual(result,{requests:[],total:0,page:3,pages:0});
});

test('GET /mine customer envelope carries the enriched status payload',async t=>{
 const chat=require('../controllers/occasionConversation.controller');
 const rows=[requestRow('r1',{status:'sent'})];
 const capture=thread(t,rows,[{_id:'r1',firstStaffReplyAt:new Date('2026-11-06T09:40:00Z')}],[{_id:'r1',customerUnreadCount:2}]);
 let payload;const res={headersSent:false,json:body=>{payload=body;},set(){},status(code){this.statusCode=code;return this;}};
 await chat.list({user:{_id:'u1',role:'customer'},query:{},params:{}},res);
 assert.equal(res.statusCode,undefined,()=>`unexpected error response ${JSON.stringify(payload)}`);
 assert.equal(payload.success,true);assert.deepEqual(capture.ownerQuery,{customer:'u1'});
 const [request]=payload.data.requests;
 assert.equal(request.reference,'DH-EVT-r1');assert.equal(request.status,'sent');
 assert.equal(request.hasStaffReply,true);assert.equal(request.firstStaffReplyAt.getTime(),new Date('2026-11-06T09:40:00Z').getTime());assert.equal(request.customerUnreadCount,2);
 for(const field of ['name','email','whatsapp','draft','attachment','lastCustomerReadAt'])assert.equal(request[field],undefined,field);
});
