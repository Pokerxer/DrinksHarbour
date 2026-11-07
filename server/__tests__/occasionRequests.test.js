const test=require('node:test');const assert=require('node:assert/strict');
const {validateRequest,validateAttachment}=require('../utils/occasionRequestInput');
const {createRequestService}=require('../services/occasionRequests/service');
const valid={submissionKey:'6bc479ec-69bf-47a7-a776-fd4c521b04ef',occasion:'weddings',name:'Ada',channel:'email',email:'ada@example.test',city:'Abuja',guests:'300',budget:'5000000',notes:'Please plan wine and soft drinks',preferences:['wine','alcohol-free'],items:[],consent:true};
function harness(overrides={}){
 let row;let sends=0;const repo={findKey:async key=>row?.submissionKey===key?row:null,create:async value=>(row={_id:'request',revision:0,...value}),get:async()=>row,list:async()=>({requests:row?[row]:[],total:row?1:0}),update:async(id,revision,changes,idle)=>{if(!row||row.revision!==revision||idle&&(row.status==='sent'||row.status==='sending'||new Date(row.busyUntil)>new Date()))return null;return row={...row,...changes,revision:revision+1};}};
 const service=createRequestService({repository:repo,generateDraft:async()=>({response:'10 × Catalogue wine — ₦100,000; confirm stock.'}),sendReply:async()=>{sends++;return {success:true,messageId:'smtp-real-id'};},notifyStaff:async()=>{},...overrides});
 return {service,row:()=>row,sends:()=>sends};
}
test('requests require an opted-in valid chosen contact and usable requirements',()=>{
 assert.equal(validateRequest(valid).email,'ada@example.test');
 for(const change of [{consent:false},{email:'ada@example.test\nBcc:x@evil.test'},{channel:'fax'},{notes:'',guests:'',budget:'',preferences:[]},{guests:'1.5'},{budget:'-2'},{preferences:['fake']},{submissionKey:'guessable'}])assert.throws(()=>validateRequest({...valid,...change}));
 const result=validateRequest({...valid,channel:'whatsapp',email:'',whatsapp:'08012345678',tenantId:'evil',status:'sent',draft:'unapproved'});
 assert.equal(result.whatsapp,'2348012345678');assert.equal(result.tenantId,undefined);assert.equal(result.status,undefined);
});
test('uploads reject executable/empty/oversized files and keep supported files private',()=>{
 for(const file of [{originalname:'x.exe',mimetype:'application/octet-stream',buffer:Buffer.from('x')},{originalname:'x.txt',mimetype:'text/plain',buffer:Buffer.alloc(0)},{originalname:'x.jpg',mimetype:'image/jpeg',buffer:Buffer.alloc(5*1024*1024+1)}])assert.throws(()=>validateAttachment(file));
 assert.equal(validateAttachment({originalname:'../list.txt',mimetype:'text/plain',buffer:Buffer.from('Wine x10')}).name,'list.txt');
});
test('submission persists once without AI or outbound customer reply and returns only receipt facts',async()=>{
 const h=harness({generateDraft:()=>{throw Error('public AI must not run');}});
 const receipt=await h.service.submit(valid,undefined,'customer');const duplicate=await h.service.submit(valid,undefined,'customer');
 assert.equal(receipt.reference,duplicate.reference);assert.equal(h.sends(),0);
 assert.equal(new Date(receipt.dueAt)-new Date(h.row().createdAt),30*60*1000);
 assert.equal(new Date(h.row().lastMessageAt).getTime(),new Date(h.row().createdAt).getTime());
 assert.equal(receipt.email,undefined);assert.equal(receipt.draft,undefined);
 await assert.rejects(h.service.submit({...valid,notes:'Different list'},undefined,'customer'),e=>e.statusCode===409);
});
test('staff AI saves a draft without sending and stale editors cannot overwrite it',async()=>{
 const h=harness();await h.service.submit(valid,undefined,'customer');
 const draft=await h.service.generate('request',{revision:0},'staff');
 assert.match(draft.draft,/Catalogue wine/);assert.equal(h.sends(),0);
 await assert.rejects(h.service.save('request',{revision:0,draft:'Old draft'},'staff'),e=>e.statusCode===409);
 await assert.rejects(h.service.send('request',{revision:draft.revision,approved:false},'staff'),e=>e.statusCode===400);
 const sent=await h.service.send('request',{revision:draft.revision,approved:true},'staff');
 assert.equal(sent.status,'sent');assert.equal(h.sends(),1);
 await assert.rejects(h.service.send('request',{revision:sent.revision,approved:true},'staff'),e=>e.statusCode===409);
});
test('failed or simulated delivery leaves a recoverable draft instead of a sent claim',async()=>{
 for(const result of [{success:false},{success:true,messageId:'dev-mode'},{success:true,messageId:'suppressed'}]){
  const h=harness({sendReply:async()=>result});await h.service.submit(valid,undefined,'customer');
  const draft=await h.service.save('request',{revision:0,draft:'Reviewed wedding drinks list'},'staff');
  const failed=await h.service.send('request',{revision:draft.revision,approved:true},'staff');
  assert.equal(failed.status,'delivery_failed');assert.equal(failed.draft,'Reviewed wedding drinks list');assert(!failed.sentAt);
 }
});
test('WhatsApp replies require explicit staff confirmation and do not use automatic outbound adapters',async()=>{
 const h=harness();await h.service.submit({...valid,channel:'whatsapp',email:'',whatsapp:'08012345678'},undefined,'customer');
 const draft=await h.service.save('request',{revision:0,draft:'Reviewed WhatsApp drinks plan'},'staff');
 await assert.rejects(h.service.send('request',{revision:draft.revision,approved:true},'staff'),e=>e.statusCode===400);
 const sent=await h.service.recordWhatsApp('request',{revision:draft.revision,approved:true},'staff');
 assert.equal(sent.status,'sent');assert.equal(sent.deliveryMethod,'staff_whatsapp');assert.equal(h.sends(),0);
});
test('a failed staff AI check preserves the saved reply and clears its busy lock',async()=>{
 const h=harness({generateDraft:async()=>{throw Error('Catalogue unavailable');}});await h.service.submit(valid,undefined,'customer');
 const saved=await h.service.save('request',{revision:0,draft:'Manually reviewed existing plan'},'staff');
 await assert.rejects(h.service.generate('request',{revision:saved.revision},'staff'),/Catalogue unavailable/);
 assert.equal(h.row().draft,'Manually reviewed existing plan');assert.equal(h.row().aiRunning,false);assert.equal(h.sends(),0);
});
test('a reply cannot be edited or sent while the catalogue AI owns the request revision',async()=>{
 let finish;const h=harness({generateDraft:()=>new Promise(resolve=>{finish=resolve;})});await h.service.submit(valid,undefined,'customer');
 const pending=h.service.generate('request',{revision:0},'staff');await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(h.service.save('request',{revision:h.row().revision,draft:'Concurrent edit'},'other'),e=>e.statusCode===409);
 finish({response:'Reviewed current catalogue list'});await pending;assert.equal(h.sends(),0);
});
test('staff send arguments cannot redirect a reply away from the persisted customer contact',async()=>{
 let recipient;const h=harness({sendReply:async row=>{recipient=row.email;return {success:true,messageId:'accepted'};}});await h.service.submit(valid,undefined,'customer');
 const draft=await h.service.save('request',{revision:0,draft:'Approved catalogue plan'},'staff');
 await h.service.send('request',{revision:draft.revision,approved:true,email:'other@example.test'},'staff');assert.equal(recipient,'ada@example.test');
});
test('profile ownership is server supplied and an account cannot reuse another account submission key',async()=>{
 const h=harness();await assert.rejects(h.service.submit(valid),e=>e.statusCode===401);await h.service.submit({...valid,customer:'forged'},undefined,'ada');assert.equal(h.row().customer,'ada');await assert.rejects(h.service.submit(valid,undefined,'other'),e=>e.statusCode===409);
});
test('staff approval publishes the reply to chat while keeping an external reply outstanding',async()=>{
 const messages=[];const h=harness({publishMessage:async row=>messages.push(row.draft)});await h.service.submit(valid,undefined,'customer');
 const draft=await h.service.save('request',{revision:0,draft:'Reviewed wine and juice plan'},'staff');assert.equal(messages.length,0);
 await assert.rejects(h.service.publishChat('request',{revision:draft.revision,approved:false},'staff'),e=>e.statusCode===400);
 const published=await h.service.publishChat('request',{revision:draft.revision,approved:true},'staff');assert.equal(messages[0],'Reviewed wine and juice plan');assert.equal(h.sends(),0);assert.equal(published.deliveryMethod,'chat');assert.equal(published.status,'draft');
});
test('each customer follow-up gets a new staff notice instead of colliding with the intake notice',()=>{
 const {staffNotice}=require('../services/occasionRequests/delivery');const row={_id:'request',reference:'DH-EVT-ONE'};
 const initial=staffNotice(row,'staff'),followUp=staffNotice({...row,lastCustomerMessageAt:new Date('2026-10-21T12:00:00Z')},'staff');
 assert.notEqual(initial.dedupKey,followUp.dedupKey);assert.match(followUp.title,/replied/);assert.equal(followUp.metadata.occasionRequestId,'request');assert(!followUp.message.includes('ada@example.test'));
});
