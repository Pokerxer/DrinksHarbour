'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {validateRequest,validateAttachment,invalid}=require('../../utils/occasionRequestInput');
const conflict=()=>Object.assign(new Error('This request changed or is busy. Refresh it before continuing.'),{statusCode:409});
const present=row=>{if(!row)return row;const {submissionKey,fingerprint,...safe}=row;return {...safe,...(safe.attachment?{attachment:{name:safe.attachment.name,contentType:safe.attachment.contentType,size:safe.attachment.size}}:{})};};
function createRequestService({repository,generateDraft,sendReply,notifyStaff=async()=>{},publishMessage=async()=>{},now=()=>new Date()}){
 const get=async id=>{const row=await repository.get(id);if(!row)throw Object.assign(new Error('Request not found.'),{statusCode:404});return row;};
 function version(input){if(!Number.isSafeInteger(input?.revision)||input.revision<0)throw invalid('Refresh the request before continuing.');return input.revision;}
 async function update(id,input,changes,idle=true){const row=await repository.update(id,version(input),changes,idle);if(!row)throw conflict();return row;}
 function approved(input,row){if(input.approved!==true)throw invalid('Review and approve the reply before sending.');if(!row.draft?.trim())throw invalid('Save a reply before sending.');}
 return {
  async submit(input,file,customer){
   if(!customer)throw Object.assign(new Error('Sign in to save your request and conversation.'),{statusCode:401});
   const attachment=validateAttachment(file),value=validateRequest(input,!!attachment);
   value.customer=String(customer);
   const fingerprint=createHash('sha256').update(JSON.stringify({...value,consentAt:undefined})).update(attachment?.data||'').digest('hex');
   let row=await repository.findKey(value.submissionKey);
   if(!row){try{const submittedAt=now();row=await repository.create({...value,attachment,fingerprint,reference:`DH-EVT-${randomBytes(5).toString('hex').toUpperCase()}`,createdAt:submittedAt,lastMessageAt:submittedAt,dueAt:new Date(submittedAt.getTime()+30*60*1000),status:'pending',busyUntil:new Date(0)});try{await notifyStaff(row);}catch{/* Durable queue remains the source of truth. */}}catch(error){if(error.code!==11000)throw error;row=await repository.findKey(value.submissionKey);}}
   if(!row||row.fingerprint!==fingerprint)throw conflict();
   return {reference:row.reference,dueAt:row.dueAt,channel:row.channel,conversationId:String(row._id)};
  },
  async list(options){const result=await repository.list(options);return {...result,requests:result.requests.map(present)};},
  async detail(id){return present(await get(id));},
  async file(id){const row=await repository.get(id,true);if(!row?.attachment?.data)throw Object.assign(new Error('Attachment not found.'),{statusCode:404});return row.attachment;},
  async save(id,input,actor){const draft=typeof input.draft==='string'?input.draft.trim():'';if(draft.length<5||draft.length>16000)throw invalid('Write a reply between 5 and 16,000 characters.');return present(await update(id,input,{draft,status:'draft',updatedBy:actor,deliveryError:''}));},
  async generate(id,input,actor){
   const row=await update(id,input,{busyUntil:new Date(now().getTime()+5*60*1000),aiRunning:true,updatedBy:actor});
   try{const result=await generateDraft(await repository.get(id,true),typeof input.instructions==='string'?input.instructions.slice(0,2000):'');if(!result?.response||result.attachmentUnreadable)throw new Error('The attachment could not be read. Inspect the original file and prepare the reply manually.');
    return present(await update(id,{revision:row.revision},{draft:result.response.slice(0,16000),status:'draft',aiRunning:false,busyUntil:new Date(0),aiModel:'claude-haiku-4-5',updatedBy:actor},false));
   }catch(error){await repository.update(id,row.revision,{aiRunning:false,busyUntil:new Date(0)},false);throw error;}
  },
  async send(id,input,actor){
   const current=await get(id);approved(input,current);if(current.channel!=='email')throw invalid('Send WhatsApp replies manually, then record them as sent.');
   const row=await update(id,input,{status:'sending',replyStartedAt:now(),busyUntil:new Date(now().getTime()+5*60*1000),updatedBy:actor});
   let result;try{await publishMessage(row,actor);result=await sendReply(row);}catch{result={success:false};}
   const accepted=result?.success&&typeof result.messageId==='string'&&result.messageId.length>0&&!['dev-mode','suppressed'].includes(result.messageId);
   return present(await update(id,{revision:row.revision},accepted?{status:'sent',sentAt:now(),sentBy:actor,deliveryMethod:'email',providerMessageId:result.messageId,deliveryError:'',busyUntil:new Date(0)}:{status:'delivery_failed',deliveryError:'Email was not accepted by the mail service. The reply is saved; check the mail configuration or retry after checking for delivery.',busyUntil:new Date(0)},false));
  },
  async publishChat(id,input,actor){
   const current=await get(id);approved(input,current);
   const row=await update(id,input,{status:'sending',replyStartedAt:now(),busyUntil:new Date(now().getTime()+5*60*1000),updatedBy:actor});
   try{await publishMessage(row,actor);return present(await update(id,{revision:row.revision},{status:'draft',deliveryMethod:'chat',busyUntil:new Date(0)},false));}
   catch(error){await repository.update(id,row.revision,{status:'draft',busyUntil:new Date(0)},false);throw error;}
  },
  async recordWhatsApp(id,input,actor){
   const current=await get(id);approved(input,current);if(current.channel!=='whatsapp')throw invalid('This customer chose email.');
   const row=await update(id,input,{status:'sending',replyStartedAt:now(),busyUntil:new Date(now().getTime()+5*60*1000),updatedBy:actor});
   try{await publishMessage(row,actor);return present(await update(id,{revision:row.revision},{status:'sent',sentAt:now(),sentBy:actor,deliveryMethod:'staff_whatsapp',busyUntil:new Date(0)},false));}
   catch(error){await repository.update(id,row.revision,{status:'draft',busyUntil:new Date(0)},false);throw error;}
  },
 };
}
module.exports={createRequestService};
