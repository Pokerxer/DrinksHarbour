'use strict';
const Request=require('../../models/OccasionRequest'),Message=require('../../models/OccasionMessage');
// Earliest published staff message per request: the read-only "our team replied" timestamp.
function firstStaffReplies(ids){if(!ids.length)return Promise.resolve(new Map());return Message.aggregate([{$match:{request:{$in:ids},sender:'staff'}},{$group:{_id:'$request',firstStaffReplyAt:{$min:'$createdAt'}}}]).then(rows=>new Map(rows.map(row=>[String(row._id),row.firstStaffReplyAt])));}
// Per-request unread count for the listing customer: staff messages strictly newer than that customer's read mark. Rows without a mark stay silent (0).
function customerUnreadCounts(ids){if(!ids.length)return Promise.resolve(new Map());return Message.aggregate([
 {$match:{request:{$in:ids},sender:'staff'}},
 {$lookup:{from:Request.collection.name,localField:'request',foreignField:'_id',as:'requestDoc',pipeline:[{$project:{_id:0,lastCustomerReadAt:1}}]}},
 {$project:{request:1,createdAt:1,readAt:{$arrayElemAt:['$requestDoc.lastCustomerReadAt',0]}}},
 {$match:{$expr:{$and:[{$ne:[{$ifNull:['$readAt',null]},null]},{$gt:['$createdAt','$readAt']}]}}},
 {$group:{_id:'$request',customerUnreadCount:{$sum:1}}},
]).then(rows=>new Map(rows.map(row=>[String(row._id),row.customerUnreadCount])));}
module.exports={
 request:(id,customer)=>Request.findOne({_id:id,...(customer?{customer}:{})}).lean(),
 async list(customer,{page=1}={}){page=Math.max(1,Math.min(10000,Number.parseInt(page,10)||1));const filter={customer};const [requests,total]=await Promise.all([Request.find(filter).select('reference occasion status city createdAt dueAt lastMessageAt').sort({lastMessageAt:-1,createdAt:-1}).skip((page-1)*20).limit(20).lean(),Request.countDocuments(filter)]);const [replies,unread]=await Promise.all([firstStaffReplies(requests.map(request=>request._id)),customerUnreadCounts(requests.map(request=>request._id))]);return {requests:requests.map(request=>({...request,hasStaffReply:replies.has(String(request._id)),firstStaffReplyAt:replies.get(String(request._id))||null,customerUnreadCount:unread.get(String(request._id))||0})),total,page,pages:Math.ceil(total/20)};},
 async messages(request,before,after){
  // Incremental poll mode (`after`): strictly newer, ascending, capped at 30; client re-pages with the last id.
  if(after)return {messages:await Message.find({request,_id:{$gt:after}}).sort({_id:1}).limit(30).select('sender content createdAt').lean(),olderCursor:null};
  const rows=await Message.find({request,...(before?{_id:{$lt:before}}:{})}).sort({_id:-1}).limit(31).select('sender content createdAt').lean();const more=rows.length>30;if(more)rows.pop();return {messages:rows.reverse(),olderCursor:more?String(rows[0]._id):null};},
 // Owner-customer read watermark: only advances, never moves backwards.
 markCustomerRead:(id,at)=>Request.updateOne({_id:id,$or:[{lastCustomerReadAt:{$exists:false}},{lastCustomerReadAt:{$lt:at}}]},{$set:{lastCustomerReadAt:at}}),
 async add(value){try{return {message:(await Message.create(value)).toObject(),created:true};}catch(error){if(error.code!==11000)throw error;return {message:await Message.findOne({request:value.request,messageKey:value.messageKey}).lean(),created:false};}},
 reopen:(id,message)=>Request.updateOne({_id:id,$or:[{lastCustomerMessageAt:{$lt:new Date(message.createdAt)}},{lastCustomerMessageAt:{$exists:false}}]},{$set:{status:'pending',lastMessageAt:new Date(message.createdAt),lastCustomerMessageAt:new Date(message.createdAt),dueAt:new Date(new Date(message.createdAt).getTime()+30*60*1000)}}),
 file:id=>Request.findOne({_id:id}).select('+attachment.data').lean().then(row=>row?.attachment),
};
