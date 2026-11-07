'use strict';
const Model=require('../../models/OccasionRequest');
const statuses=['pending','draft','sending','sent','delivery_failed'];
module.exports={
 findKey:key=>Model.findOne({submissionKey:key}).select('+submissionKey +fingerprint').lean(),
 create:async value=>(await Model.create(value)).toObject(),
 get:(id,file=false)=>Model.findOne({_id:id}).select(file?'+attachment.data':'').lean(),
 async list({page=1,status}={}){page=Math.max(1,Math.min(10000,Number.parseInt(page,10)||1));const filter=statuses.includes(status)?{status}:{};const [requests,total]=await Promise.all([Model.find(filter).sort({lastMessageAt:-1,createdAt:-1}).skip((page-1)*20).limit(20).lean(),Model.countDocuments(filter)]);return {requests,total,page,pages:Math.ceil(total/20)};},
 async update(id,revision,changes,idle){let row=await Model.findOneAndUpdate({_id:id,revision,...(idle?{status:{$nin:['sent','sending']},$or:[{busyUntil:{$lte:new Date()}},{busyUntil:{$exists:false}}]}:{})},{$set:changes,$inc:{revision:1}},{new:true,runValidators:true}).lean();if(row&&changes.status==='sent'&&row.lastCustomerMessageAt&&row.replyStartedAt&&row.lastCustomerMessageAt>row.replyStartedAt){row=await Model.findOneAndUpdate({_id:id,revision:row.revision,status:'sent'},{$set:{status:'pending'}},{new:true}).lean()||row;}return row;},
};
