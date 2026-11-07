const test=require('node:test'),assert=require('node:assert/strict');
const {createConversationService}=require('../services/occasionRequests/conversation');
function setup({failFirstReopen=false,messages=null}={}){const rows=[];let reopened=0;const readMarks=[];const request={_id:'thread',customer:'ada',reference:'DH-EVT-ONE',draft:'SECRET UNAPPROVED AI DRAFT',notes:'Wine for wedding',attachment:{name:'list.txt',data:Buffer.from('secret')}};const repository={request:async(id,customer)=>id==='thread'&&(!customer||customer==='ada')?request:null,messages:messages||(async()=>({messages:rows,olderCursor:null})),markCustomerRead:async(id,at)=>{readMarks.push(at);},add:async value=>{const old=rows.find(row=>row.messageKey===value.messageKey);if(old)return {message:old,created:false};const message={...value,_id:String(rows.length+1),createdAt:new Date('2026-10-21T12:00:00Z')};rows.push(message);return {message,created:true};},reopen:async(id,message)=>{reopened++;if(failFirstReopen){failFirstReopen=false;throw Error('Database unavailable');}request.lastCustomerMessageAt=message.createdAt;},file:async()=>request.attachment,list:async customer=>({requests:customer==='ada'?[{_id:'thread'}]:[]})};return {service:createConversationService({repository}),reopened:()=>reopened,rows,readMarks:()=>readMarks};}
test('customers can reopen saved conversations but never another customer thread or private AI draft',async()=>{const h=setup();const result=await h.service.read('thread',{id:'ada',role:'customer'});assert.equal(result.request.reference,'DH-EVT-ONE');assert.equal(result.request.draft,undefined);assert.equal(result.request.attachment.data,undefined);for(const action of ['read','file'])await assert.rejects(h.service[action]('thread',{id:'other',role:'customer'}),e=>e.statusCode===404);await assert.rejects(h.service.read('thread',{id:'tenant',role:'tenant_admin'}),e=>e.statusCode===403);});
test('customer follow-ups persist idempotently and reopen the request once',async()=>{const h=setup(),input={content:'Please change the guest count to250.',messageKey:'6bc479ec-69bf-47a7-a776-fd4c521b04ef'},viewer={id:'ada',role:'customer'};const one=await h.service.send('thread',viewer,input),two=await h.service.send('thread',viewer,input);assert.equal(one._id,two._id);assert.equal(h.rows.length,1);assert.equal(h.reopened(),1);assert.equal((await h.service.read('thread',viewer)).messages[0].content,'Please change the guest count to250.');await assert.rejects(h.service.send('thread',{id:'other',role:'customer'},input),e=>e.statusCode===404);await assert.rejects(h.service.send('thread',viewer,{...input,content:'Different'}),e=>e.statusCode===409);});
test('the production conversation repository includes the customer in its ownership query',async t=>{
 const Request=require('../models/OccasionRequest');let query;t.mock.method(Request,'findOne',value=>{query=value;return {lean:async()=>null};});
 const repository=require('../services/occasionRequests/conversationRepository');await repository.request('507f1f77bcf86cd799439011','507f191e810c19729de860ea');assert.deepEqual(query,{_id:'507f1f77bcf86cd799439011',customer:'507f191e810c19729de860ea'});
});

test('retry repairs a request reopen that failed after the customer message was already stored',async()=>{const h=setup({failFirstReopen:true}),input={content:'Please adjust my list.',messageKey:'6bc479ec-69bf-47a7-a776-fd4c521b04ef'},viewer={id:'ada',role:'customer'};await assert.rejects(h.service.send('thread',viewer,input),/Database unavailable/);await h.service.send('thread',viewer,input);assert.equal(h.rows.length,1);assert.equal(h.reopened(),2);});

// --- DRI-26: incremental `after` cursor reads + authoritative customer unread state ---

const hexId=n=>new (require('mongoose').Types.ObjectId)(n.toString(16).padStart(24,'0'));

test('after cursor serves only newer messages ascending, capped at thirty, with the request brief riding along',async()=>{
 const rows=[];for(let i=1;i<=40;i++)rows.push({_id:hexId(i),sender:i%2?'staff':'customer',content:'m'+i,createdAt:new Date(1000*i)});
 const calls=[];
 const messages=async(id,before,after)=>{calls.push({before,after});if(after)return {messages:rows.filter(row=>String(row._id)>String(after)).sort((a,b)=>String(a._id)<String(b._id)?-1:1).slice(0,30),olderCursor:null};return {messages:[...rows].reverse().slice(0,30),olderCursor:null};};
 const h=setup({messages});
 const viewer={id:'ada',role:'customer'};
 const first=await h.service.read('thread',viewer,{after:String(rows[8]._id)});
 assert.deepEqual(calls[0],{before:undefined,after:String(rows[8]._id)});
 assert.equal(first.messages.length,30,'cap of thirty in after mode');
 assert.deepEqual(first.messages.map(row=>row.content),rows.slice(9,39).map(row=>row.content),'ascending, strictly newer only');
 assert.equal(first.olderCursor,null);
 assert.equal(first.request.reference,'DH-EVT-ONE','brief still returned in after mode');
 assert.equal(first.request.draft,undefined);
 const second=await h.service.read('thread',viewer,{after:String(first.messages.at(-1)._id)});
 assert.deepEqual(second.messages.map(row=>row.content),['m40'],'re-paging from the last returned id keeps the remainder');
 const third=await h.service.read('thread',viewer,{after:String(second.messages[0]._id)});
 assert.deepEqual(third.messages,[]);
 // Full read without cursors regresses green: newest 30 ascending.
 const full=await h.service.read('thread',viewer);
 assert.equal(full.messages[0].content,'m40');
 assert.equal(full.messages.length,30);
});

test('malformed after and before cursors short-circuit to the same conversation 404 without touching the repository',async t=>{
 const Request=require('../models/OccasionRequest');let queries=0;
 t.mock.method(Request,'findOne',()=>{queries++;return {lean:async()=>null};});
 const chat=require('../controllers/occasionConversation.controller');
 const respond=action=>new Promise(resolve=>{const res={headersSent:false,statusCode:0,body:null,status(code){this.statusCode=code;return this;},json(body){resolve({statusCode:this.statusCode,body});return this;}};action(res);});
 const owner={params:{id:'507f1f77bcf86cd799439011'},user:{_id:'507f191e810c19729de860ea',role:'customer'}};
 for(const query of [{after:'zzz'},{before:'zzz'},{after:'zzz',before:'zzz'}]){
  const out=await respond(res=>chat.read({...owner,query},res));
  assert.equal(out.statusCode,404,`guard for ${JSON.stringify(query)}`);
  assert.equal(out.body.message,'Conversation not found.');
  assert.equal(queries,0,'repository untouched by malformed cursors');
 }
 const passed=await respond(res=>chat.read({...owner,query:{after:'507f1f77bcf86cd799439013'}},res));
 assert.equal(passed.statusCode,404,'valid after cursor passes the guard and reaches the repository');
 assert.equal(queries,1);
});

test('owning customer reads persist their read mark; admin and super_admin perusals never write one',async()=>{
 const h=setup();
 const viewer={id:'ada',role:'customer'};
 await h.service.read('thread',viewer,{after:null});
 assert.equal(h.readMarks().length,1,'customer read persists the mark');
 assert(h.readMarks()[0] instanceof Date);
 await h.service.read('thread',{id:'boss',role:'admin'});
 await h.service.read('thread',{id:'root',role:'super_admin'});
 assert.equal(h.readMarks().length,1,'staff-side or admin reads never write read state');
 const first=h.readMarks()[0].getTime();
 await h.service.read('thread',viewer);
 assert(h.readMarks()[1].getTime()>=first,'a later read carries a fresh timestamp');
});

test('production conversation repository pages after/before ascending, keeps the read mark forward-only and counts per-request customer unread',async t=>{
 const mongoose=require('mongoose');
 const {connectVenueMongo}=require('./helpers/venueMongo');
 await connectVenueMongo(t,'occ_thread_cursor');
 const Request=require('../models/OccasionRequest'),Message=require('../models/OccasionMessage'),repository=require('../services/occasionRequests/conversationRepository');
 const customer=new mongoose.Types.ObjectId();
 const base={customer,occasion:'gifting',name:'Ada Obi',channel:'email',email:'ada@example.com',consentAt:new Date(),city:'Abuja',dueAt:new Date(Date.now()+36e5)};
 const at=(minuteOffset)=>new Date(Date.parse('2026-11-06T10:00:00Z')+minuteOffset*60000);
 let counter=0;
 const key=prefix=>`${prefix}-${++counter}`;
 const modern=await Request.create({...base,reference:'DH-EVT-UNREAD',submissionKey:key('sk'),fingerprint:key('fp')});
 const legacy=await Request.create({...base,reference:'DH-EVT-LEGACY',submissionKey:key('sk'),fingerprint:key('fp')});
 const PagingRequest=await Request.create({...base,reference:'DH-EVT-PAGING',submissionKey:key('sk'),fingerprint:key('fp')});
 const staffMessage=async(request,when)=>Message.create({request,customer,author:customer,sender:'staff',content:`staff reply at ${when.toISOString()}`,messageKey:key('mk'),createdAt:when});
 const customerMessage=async(request,when)=>Message.create({request,customer,author:customer,sender:'customer',content:`customer note at ${when.toISOString()}`,messageKey:key('mk'),createdAt:when});
 // Legacy thread: staff messages exist but the customer never opened the thread since the cutover.
 await staffMessage(legacy,at(5));
 await staffMessage(legacy,at(20));
 // Modern thread: staff at +5 and +20, customer note at +30.
 await staffMessage(modern,at(5));
 await staffMessage(modern,at(20));
 await customerMessage(modern,at(30));
 // First owner read past the first reply only.
 await repository.markCustomerRead(modern._id,at(10));
 // Paging thread: 35 staff messages.
 for(let i=1;i<=35;i++)await staffMessage(PagingRequest,at(i));

 const page=await repository.list(customer);
 const row=id=>page.requests.find(entry=>String(entry._id)===String(id));
 assert.equal(row(legacy._id).customerUnreadCount,0,'legacy rows without the field report zero unread');
 assert.equal(row(modern._id).customerUnreadCount,1,'counts staff messages newer than the read mark');
 assert.equal(row(modern._id).firstStaffReplyAt.toISOString(),at(5).toISOString(),'firstStaffReplies semantics kept');
 assert.equal(row(PagingRequest._id).customerUnreadCount,0,'threads without any read mark stay silent');
 // Drain after a newer read.
 await repository.markCustomerRead(modern._id,at(31));
 const reloaded=await repository.list(customer);
 const modernRow=reloaded.requests.find(entry=>String(entry._id)===String(modern._id));
 assert.equal(modernRow.customerUnreadCount,0,'drains after a newer read');
 // The watermark never moves backwards.
 await repository.markCustomerRead(modern._id,at(1));
 const afterOld=await Request.findById(modern._id).lean();
 assert.equal(afterOld.lastCustomerReadAt.toISOString(),at(31).toISOString());
 // after paging: only newer, ascending, capped at thirty, olderCursor untouched (null there).
 const page35=await Message.find({request:PagingRequest._id}).sort({_id:1}).limit(35).lean();
 const newer=await repository.messages(String(PagingRequest._id),null,String(page35[4]._id));
 assert.equal(newer.messages.length,30,'after mode caps at thirty');
 assert.deepEqual(newer.messages.map(row=>row.content),page35.slice(5).map(row=>row.content),'strictly newer, ascending by _id');
 assert.equal(newer.olderCursor,null);
 // before mode regression: newest window, olderCursor semantics kept.
 const older=await repository.messages(String(PagingRequest._id),String(page35[5]._id));
 assert.deepStrictEqual(older.messages.map(row=>row.content),page35.slice(0,5).map(row=>row.content));
 assert.equal(older.olderCursor,null);
});
