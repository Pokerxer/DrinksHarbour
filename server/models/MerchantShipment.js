'use strict';
const mongoose=require('mongoose'),{Schema}=mongoose;
const schema=new Schema({
 _id:String,merchantOrder:{type:String,required:true,immutable:true},order:{type:Schema.Types.ObjectId,required:true,immutable:true},tenant:{type:Schema.Types.ObjectId,required:true,immutable:true},location:{type:Schema.Types.ObjectId,required:true,immutable:true},customer:{type:Schema.Types.ObjectId,required:true,immutable:true},
 quote:{type:Schema.Types.ObjectId,required:true,immutable:true},provider:{type:String,enum:['pickup'],required:true,immutable:true},currency:{type:String,enum:['NGN'],required:true,immutable:true},amountMinor:{type:Number,enum:[0],required:true,immutable:true},
 bookedBy:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,enum:['pickup_booked'],required:true,immutable:true},
 operationHash:{type:String,required:true,immutable:true},scopeHash:{type:String,required:true,immutable:true},status:{type:String,enum:['booked'],default:'booked',immutable:true},
},{timestamps:true,autoIndex:false});
schema.index({merchantOrder:1},{unique:true});schema.index({tenant:1,createdAt:-1});
module.exports=mongoose.models.MerchantShipment||mongoose.model('MerchantShipment',schema);
