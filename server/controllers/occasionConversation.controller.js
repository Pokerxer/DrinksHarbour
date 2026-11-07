'use strict';
const mongoose=require('mongoose');
const {createConversationService}=require('../services/occasionRequests/conversation');
const service=createConversationService({repository:require('../services/occasionRequests/conversationRepository'),notifyStaff:require('../services/occasionRequests/delivery').notifyStaff});
const viewer=req=>({id:req.user._id,role:req.user.role});
function wrap(action){return async(req,res)=>{try{if(req.params.id&&!mongoose.isValidObjectId(req.params.id)||req.query.before&&!mongoose.isValidObjectId(req.query.before)||req.query.after&&!mongoose.isValidObjectId(req.query.after))return res.status(404).json({success:false,message:'Conversation not found.'});const result=await action(req,res);if(!res.headersSent)res.json({success:true,data:result});}catch(error){res.status(error.statusCode||500).json({success:false,message:error.statusCode?error.message:'Conversation unavailable. Your saved messages are retained; please retry.'});}};}
exports.list=wrap(req=>service.list(req.user._id,req.query));
exports.read=wrap(req=>service.read(req.params.id,viewer(req),{before:req.query.before,after:req.query.after}));
exports.send=wrap(req=>service.send(req.params.id,viewer(req),req.body));
exports.file=wrap(async(req,res)=>{const file=await service.file(req.params.id,viewer(req));if(!file?.data)return res.status(404).json({success:false,message:'Attachment not found.'});res.set({'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="list.${file.name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.send(Buffer.isBuffer(file.data)?file.data:Buffer.from(file.data.buffer));});
