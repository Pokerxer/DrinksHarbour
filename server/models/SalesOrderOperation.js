const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  tenant: {type:Schema.Types.ObjectId, ref:'Tenant', required:true},
  salesOrder: {type:Schema.Types.ObjectId, ref:'SalesOrder', required:true},
  kind: {type:String, required:true, enum:['fulfill','pos','payment']},
  requestId: {type:String, required:true, maxlength:128},
  fingerprint: {type:String, required:true},
  state: {type:String, enum:['pending','settled','failed','needs_review'], default:'pending'},
  result: Schema.Types.Mixed,
}, {timestamps:true});
schema.index({tenant:1,salesOrder:1,kind:1,requestId:1}, {unique:true});
module.exports = mongoose.models.SalesOrderOperation || mongoose.model('SalesOrderOperation', schema);
