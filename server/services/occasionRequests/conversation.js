'use strict';
const {invalid}=require('../../utils/occasionRequestInput');
const missing=()=>Object.assign(new Error('Conversation not found.'),{statusCode:404});
function createConversationService({repository,notifyStaff=async()=>{}}){
 async function owned(id,viewer){if(!['customer','admin','super_admin'].includes(viewer.role))throw Object.assign(new Error('Conversation access denied.'),{statusCode:403});const request=await repository.request(id,viewer.role==='customer'?viewer.id:undefined);if(!request)throw missing();return request;}
 function brief(row){return {_id:row._id,reference:row.reference,occasion:row.occasion,city:row.city,date:row.date,guests:row.guests,budget:row.budget,notes:row.notes,preferences:row.preferences,items:row.items,status:row.status,dueAt:row.dueAt,createdAt:row.createdAt,...(row.attachment?{attachment:{name:row.attachment.name,size:row.attachment.size}}:{})};}
 return {
  list:(customer,options)=>repository.list(customer,options),
  async read(id,viewer,cursors={}){
   const request=await owned(id,viewer);
   // Authoritative read state: only the request's own customer writes; a poll must not fail because of it.
   const readAt=viewer.role==='customer'?new Date():null;
   const history=await repository.messages(id,cursors.before,cursors.after);
   if(readAt)try{await repository.markCustomerRead(request._id,readAt);}catch{}
   return {request:brief(request),...history};
  },
  async send(id,viewer,input){
   if(viewer.role!=='customer')throw Object.assign(new Error('Only the customer can use this message action.'),{statusCode:403});
   const request=await owned(id,viewer);const content=typeof input.content==='string'?input.content.trim():'';
   if(!content||content.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content))throw invalid('Write a message of up to 4,000 characters.');
   if(typeof input.messageKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.messageKey))throw invalid('Refresh this conversation and retry.');
   const {message,created}=await repository.add({request:id,customer:viewer.id,author:viewer.id,sender:'customer',content,messageKey:input.messageKey});
   if(message.content!==content)throw Object.assign(new Error('This message changed. Send it again as a new message.'),{statusCode:409});
   if(created||!request.lastCustomerMessageAt||new Date(message.createdAt)>new Date(request.lastCustomerMessageAt))await repository.reopen(id,message);
   if(created){try{await notifyStaff({...request,lastCustomerMessageAt:message.createdAt});}catch{}}
   return message;
  },
  async file(id,viewer){await owned(id,viewer);return repository.file(id);},
 };
}
module.exports={createConversationService};
