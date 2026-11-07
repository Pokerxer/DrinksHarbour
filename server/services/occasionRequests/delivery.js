'use strict';
const {sendEmail}=require('../email.service');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function sendReply(row){
 // Recipient always comes from the persisted, consented request, never staff input.
 const text=`Hello ${row.name},\n\nHere is the drinks plan reviewed by our team for your ${row.occasion}.\nReference: ${row.reference}\n\n${row.draft}\n\nPrices, stock and delivery need confirmation before ordering. Your plan and conversation are saved in your profile. Continue chatting with our team at https://drinksharbour.com/my-account/chat/${row._id}.\n\nDrinksHarbour`;
 return sendEmail({to:row.email,subject:`Your DrinksHarbour occasion plan — ${row.reference}`,text,html:`<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escape(text)}</div>`});
}
function staffNotice(row,recipient){
 const followUp=row.lastCustomerMessageAt;
 return {recipient,type:'general',title:followUp?'Customer replied to an occasion request':'New occasion drinks request',message:`${row.reference} is ready in Occasion requests. Aim to reply within about 30 minutes.`,priority:'high',dedupKey:`occasion:${row._id}:${followUp?new Date(followUp).getTime():'initial'}`,metadata:{occasionRequestId:String(row._id)}};
}
async function notifyStaff(row){
 const User=require('../../models/User'),Notification=require('../../models/Notification');
 const recipients=await User.find({role:{$in:['admin','super_admin']},status:'active'}).select('_id').limit(50).lean();
 if(recipients.length)await Notification.insertMany(recipients.map(user=>staffNotice(row,user._id)),{ordered:false});
}
module.exports={sendReply,notifyStaff,staffNotice};
