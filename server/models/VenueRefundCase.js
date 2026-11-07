'use strict';
const {Schema,model}=require('mongoose');
const schema=new Schema({
 tenant:{type:Schema.Types.ObjectId,required:true},location:{type:Schema.Types.ObjectId,required:true},receipt:{type:Schema.Types.ObjectId,required:true},
 amountMinor:{type:Number,required:true},currency:{type:String,enum:['NGN'],default:'NGN'},key:{type:String,required:true},
 reason:{type:String,required:true},evidence:[String],requestedBy:Schema.Types.ObjectId,approvedBy:Schema.Types.ObjectId,approvalReason:String,
 state:{type:String,enum:['review_required','approved','submitting','pending','processed','failed','needs_review'],default:'review_required'},version:{type:Number,default:0},
 sourceAmounts:{type:Schema.Types.Mixed,required:true},policySnapshot:Schema.Types.Mixed,submissionStartedAt:{type:Date,default:null},providerRefundId:String,
 providerEvidence:{linkedBy:Schema.Types.ObjectId,linkedAt:Date,reason:String,references:[String],verifiedStatus:String},
 processedAt:Date,providerFeeResolution:{type:String,default:'review_required'},lastErrorCode:String,
},{timestamps:true,autoIndex:false});
schema.index({tenant:1,receipt:1,key:1},{unique:true});schema.index({providerRefundId:1},{unique:true,partialFilterExpression:{providerRefundId:{$type:'string'}}});
schema.index({tenant:1,location:1,state:1,createdAt:1});
module.exports=model('VenueRefundCase',schema);
