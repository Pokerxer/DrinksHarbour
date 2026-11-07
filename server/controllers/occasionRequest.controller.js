'use strict';
const mongoose=require('mongoose');
const {createRequestService}=require('../services/occasionRequests/service');
const service=createRequestService({repository:require('../services/occasionRequests/repository'),...require('../services/occasionRequests/ai'),...require('../services/occasionRequests/messages'),...require('../services/occasionRequests/delivery')});
function handler(action,mutation=false){return async(req,res)=>{try{
 if(req.params.id&&!mongoose.isValidObjectId(req.params.id))return res.status(404).json({success:false,message:'Request not found.'});
 const result=await action(req,res);if(res.headersSent)return;
 if(mutation)await require('../models/AuditLog').create({actorUserId:req.user._id,actorRole:req.user.role,action:`OCCASION_REQUEST_${req.path.split('/').pop().toUpperCase()}`,actionCategory:'update',targetType:'OccasionRequest',targetId:req.params.id,changes:{after:{status:result?.status,revision:result?.revision}}}).catch(()=>{});
 res.json({success:true,data:result});
 }catch(error){const status=error.statusCode||500;res.status(status).json({success:false,message:status<500?error.message:'This action could not be completed. Your saved request or reply is retained; refresh and try again.'});}};}
exports.submit=handler(async req=>{let input;try{input=typeof req.body.payload==='string'?JSON.parse(req.body.payload):req.body;}catch{throw Object.assign(new Error('Check your request details.'),{statusCode:400});}return service.submit(input,req.file,req.user._id);});
exports.list=handler(req=>service.list(req.query));
exports.detail=handler(req=>service.detail(req.params.id));
exports.file=handler(async(req,res)=>{const file=await service.file(req.params.id);res.set({'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="list.${file.name.split('.').pop()}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.send(Buffer.isBuffer(file.data)?file.data:Buffer.from(file.data.buffer));});
for(const method of ['save','generate','send','recordWhatsApp','publishChat'])exports[method]=handler(req=>service[method](req.params.id,req.body,req.user._id),true);
