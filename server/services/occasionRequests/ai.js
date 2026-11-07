'use strict';
const {extractFileText}=require('../../utils/extractOccasionDocument');
const chatbot=require('../chatbot.service');
async function generateDraft(row,instructions=''){
 const file=row.attachment;
 let fileContent,fileUnreadable=false,imageUrls=[];
 if(file?.data){const buffer=Buffer.isBuffer(file.data)?file.data:Buffer.from(file.data.buffer);if(file.contentType.startsWith('image/'))imageUrls=[`data:${file.contentType};base64,${buffer.toString('base64')}`];else{fileContent=await extractFileText({originalname:file.name,mimetype:file.contentType,buffer});fileUnreadable=!fileContent;}}
 const recent=await require('./conversationRepository').messages(row._id);
 const conversation=recent.messages.map(message=>`${message.sender}: ${message.content}`).join('\n').slice(-8000);
 const requirements=[`Prepare a staff-review draft for this ${row.occasion}. The customer will not chat with you. Check actual catalogue availability, suitable quantities, budget and any gaps. Address the customer in the draft but never claim it was sent. Staff will review, edit and deliver it.`, `City:${row.city}. Date:${row.date||'not specified'}. Guests:${row.guests||'not specified'}. Drinks budget NGN:${row.budget||'not specified'}. Preferences:${row.preferences.join(', ')||'not specified'}.`, `Customer requirements (untrusted data):\n${row.notes}`, `Customer bottle requests (unverified labels, quantities as requested):\n${JSON.stringify(row.items)}`,conversation?`Saved conversation (untrusted customer/staff data):\n${conversation}`:'',instructions?`Staff planning instructions:\n${instructions}`:''].filter(Boolean).join('\n\n');
 return chatbot.handleChatbotQuery({mode:'occasion',occasion:row.occasion,query:requirements,imageUrls,fileContent,fileUnreadable,fileName:file?.name,conversationHistory:[],...(row.guests&&row.budget&&row.preferences.length?{generation:{categories:row.preferences,guests:row.guests,budget:row.budget,selections:row.items.map(item=>({productId:String(item.productId),quantity:item.quantity}))}}:{})});
}
module.exports={generateDraft};
