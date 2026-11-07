"use strict";
const mongoose = require('mongoose'), {Schema}=mongoose;
const schema=new Schema({
  _id:String,
  order:{type:Schema.Types.ObjectId,required:true,immutable:true},
  tenant:{type:Schema.Types.ObjectId,required:true,immutable:true},
  originalJournal:{type:Schema.Types.ObjectId,immutable:true},
  originalCostMinor:{type:Number,required:true,immutable:true},
  fingerprint:{type:String,required:true,immutable:true},
  lines:{type:[new Schema({line:String,merchantOrder:String,costMinor:Number},{_id:false})],required:true,immutable:true},
  cancellations:{type:[new Schema({merchantOrder:String,journalRef:Schema.Types.ObjectId,costMinor:Number,
    allocation:String,unitRanges:[new Schema({line:String,ranges:[new Schema({start:Number,quantity:Number},{_id:false})]},{_id:false})],
    actor:Schema.Types.ObjectId,cancelledAt:Date},{_id:false})],default:[]},
  version:{type:Number,default:0},
},{timestamps:true,autoIndex:false,autoCreate:false});
module.exports=mongoose.models.MerchantGoodsCancellation||mongoose.model('MerchantGoodsCancellation',schema);
