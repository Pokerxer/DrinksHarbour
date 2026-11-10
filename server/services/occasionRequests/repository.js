'use strict';
const Model=require('../../models/OccasionRequest');
const {firstStaffReplies,customerUnreadCounts}=require('./conversationRepository');
const statuses=['pending','draft','sending','sent','delivery_failed'];
module.exports={
 findKey:key=>Model.findOne({submissionKey:key}).select('+submissionKey +fingerprint').lean(),
 create:async value=>(await Model.create(value)).toObject(),
 get:(id,file=false)=>Model.findOne({_id:id}).select(file?'+attachment.data':'').lean(),
 async list({page=1,status}={}){page=Math.max(1,Math.min(10000,Number.parseInt(page,10)||1));const filter=statuses.includes(status)?{status}:{};const [rows,total]=await Promise.all([Model.find(filter).sort({lastMessageAt:-1,createdAt:-1}).skip((page-1)*20).limit(20).lean(),Model.countDocuments(filter)]);
  // DRI-41: the staff queue reuses the customer list's read-receipt aggregates (additive only) so rows can show the unread badge and staff-reply columns from server truth.
  const ids=rows.map(row=>row._id);const [replies,unread]=await Promise.all([firstStaffReplies(ids),customerUnreadCounts(ids)]);
  const requests=rows.map(row=>({...row,hasStaffReply:replies.has(String(row._id)),firstStaffReplyAt:replies.get(String(row._id))||null,customerUnreadCount:unread.get(String(row._id))||0}));
  return {requests,total,page,pages:Math.ceil(total/20)};},
 async update(id,revision,changes,idle){let row=await Model.findOneAndUpdate({_id:id,revision,...(idle?{status:{$nin:['sent','sending']},$or:[{busyUntil:{$lte:new Date()}},{busyUntil:{$exists:false}}]}:{})},{$set:changes,$inc:{revision:1}},{new:true,runValidators:true}).lean();if(row&&changes.status==='sent'&&row.lastCustomerMessageAt&&row.replyStartedAt&&row.lastCustomerMessageAt>row.replyStartedAt){row=await Model.findOneAndUpdate({_id:id,revision:row.revision,status:'sent'},{$set:{status:'pending'}},{new:true}).lean()||row;}return row;},
};
