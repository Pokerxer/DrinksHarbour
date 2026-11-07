'use strict';
const {Schema,model}=require('mongoose');
const schema=new Schema({tenant:{type:Schema.Types.ObjectId,required:true},location:{type:Schema.Types.ObjectId,required:true},receipt:{type:Schema.Types.ObjectId,required:true},caseId:{type:Schema.Types.ObjectId,required:true},billOrder:Schema.Types.ObjectId,amountMinor:Number,appliedMinor:Number,commissionMinor:Number,taxMinor:Number,financialMinor:Number,unappliedMinor:Number,policySnapshot:Schema.Types.Mixed},{timestamps:true,autoIndex:false});
schema.index({caseId:1},{unique:true});module.exports=model('VenuePaymentReversal',schema);
