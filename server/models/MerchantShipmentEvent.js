'use strict';
const mongoose=require('mongoose'),{Schema}=mongoose;
const schema=new Schema({_id:String,recordedBy:{type:Schema.Types.ObjectId,required:true,immutable:true},shipment:{type:String,required:true,immutable:true},tenant:{type:Schema.Types.ObjectId,required:true,immutable:true},state:{type:String,enum:['pending','accepted','picking','shipped','delivered','cancelled'],required:true,immutable:true},merchantVersion:{type:Number,required:true,immutable:true},source:{type:String,enum:['merchant_order'],required:true,immutable:true}},{timestamps:true,autoIndex:false});
schema.index({shipment:1,merchantVersion:1},{unique:true});
module.exports=mongoose.models.MerchantShipmentEvent||mongoose.model('MerchantShipmentEvent',schema);
