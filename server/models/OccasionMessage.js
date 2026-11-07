'use strict';
const mongoose=require('mongoose');
const {Schema}=mongoose;
const schema=new Schema({
 request:{type:Schema.Types.ObjectId,ref:'OccasionRequest',required:true,index:true},customer:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
 author:{type:Schema.Types.ObjectId,ref:'User',required:true},sender:{type:String,enum:['customer','staff'],required:true},
 content:{type:String,required:true,maxlength:16000},messageKey:{type:String,required:true,maxlength:120},
},{timestamps:true});
schema.index({request:1,messageKey:1},{unique:true});schema.index({request:1,_id:-1});
module.exports=mongoose.models.OccasionMessage||mongoose.model('OccasionMessage',schema);
