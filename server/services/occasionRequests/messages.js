'use strict';
const repository=require('./conversationRepository');
const {createHash}=require('node:crypto');
async function publishMessage(row,actor){
 await repository.add({request:row._id,customer:row.customer,author:actor,sender:'staff',content:row.draft,messageKey:`reply:${createHash('sha256').update(row.draft).update(String(row.lastCustomerMessageAt||'original')).digest('hex')}`});
 await require('../../models/OccasionRequest').updateOne({_id:row._id},{$set:{lastMessageAt:new Date()}});
}
module.exports={publishMessage};
