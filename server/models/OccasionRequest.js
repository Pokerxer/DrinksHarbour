'use strict';
const mongoose=require('mongoose');
const {Schema}=mongoose;
// Platform-owned service requests, never tenant CRM records or orders.
const schema=new Schema({
 customer:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},lastMessageAt:Date,lastCustomerMessageAt:Date,lastCustomerReadAt:Date,replyStartedAt:Date,
 reference:{type:String,required:true,unique:true},submissionKey:{type:String,required:true,unique:true,select:false},fingerprint:{type:String,required:true,select:false},
 occasion:{type:String,enum:['weddings','corporate','house-parties','gifting','bulk'],required:true},
 name:{type:String,required:true,maxlength:80},channel:{type:String,enum:['email','whatsapp'],required:true},email:{type:String,maxlength:254},whatsapp:{type:String,maxlength:15},consentAt:{type:Date,required:true},
 city:{type:String,required:true,maxlength:80},date:String,guests:Number,budget:Number,notes:{type:String,maxlength:2000},preferences:[String],
 items:[{_id:false,productId:{type:Schema.Types.ObjectId,ref:'Product'},name:{type:String,maxlength:200},quantity:Number}],
 attachment:{name:String,contentType:String,size:Number,data:{type:Buffer,select:false}},
 status:{type:String,enum:['pending','draft','sending','sent','delivery_failed'],default:'pending'},dueAt:{type:Date,required:true},
 draft:{type:String,maxlength:16000,default:''},revision:{type:Number,default:0},busyUntil:{type:Date,default:()=>new Date(0)},aiRunning:{type:Boolean,default:false},aiModel:String,
 updatedBy:{type:Schema.Types.ObjectId,ref:'User'},sentBy:{type:Schema.Types.ObjectId,ref:'User'},sentAt:Date,deliveryMethod:{type:String,enum:['email','staff_whatsapp','chat']},providerMessageId:String,deliveryError:{type:String,maxlength:500},
},{timestamps:true});
schema.index({status:1,dueAt:1});
module.exports=mongoose.models.OccasionRequest||mongoose.model('OccasionRequest',schema);
