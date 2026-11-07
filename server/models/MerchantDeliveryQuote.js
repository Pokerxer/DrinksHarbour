'use strict';
const mongoose=require('mongoose'),{Schema}=mongoose;
const schema=new Schema({
 merchantOrder:{type:String,required:true,immutable:true},order:{type:Schema.Types.ObjectId,required:true,immutable:true},
 tenant:{type:Schema.Types.ObjectId,required:true,immutable:true},location:{type:Schema.Types.ObjectId,required:true,immutable:true},customer:{type:Schema.Types.ObjectId,required:true,immutable:true},
 provider:{type:String,enum:['pickup'],required:true,immutable:true},currency:{type:String,enum:['NGN'],required:true,immutable:true},amountMinor:{type:Number,enum:[0],required:true,immutable:true},
 capabilities:{type:[String],required:true,immutable:true},coverage:{type:String,enum:['origin_location_only'],required:true,immutable:true},
 basketHash:{type:String,required:true,immutable:true},destinationHash:{type:String,required:true,immutable:true},scopeHash:{type:String,required:true,immutable:true},
 createdBy:{type:Schema.Types.ObjectId,required:true,immutable:true},action:{type:String,enum:['pickup_quote_created'],required:true,immutable:true},
 expiresAt:{type:Date,required:true},bookedShipment:String,
},{timestamps:true,autoIndex:false});
schema.index({tenant:1,merchantOrder:1});
module.exports=mongoose.models.MerchantDeliveryQuote||mongoose.model('MerchantDeliveryQuote',schema);
