'use strict';
const { Schema, model } = require('mongoose');
const schema = new Schema({
  tenant: {type:Schema.Types.ObjectId,ref:'Tenant',required:true},
  location: {type:Schema.Types.ObjectId,ref:'Warehouse',required:true},
  version: {type:Number,default:0,min:0},
  profileVersion: {type:Number,default:0,min:0},
  reviewedProfileVersion: {type:Number,default:null},
  reviewedBy: {type:Schema.Types.ObjectId,ref:'User',default:null},
  reviewedAt: {type:Date,default:null},
  slug: {type:String,default:null},
  profile: {type:Schema.Types.Mixed,default:null},
  menu: {type:Schema.Types.Mixed,default:()=>({sections:[]})},
  floor: {type:Schema.Types.Mixed,default:()=>({zones:[],tables:[]})},
  // S4 device bridge (additive): the pull client's credentials. A stations.write
  // route mints the 32-byte URL-safe token server-side and returns it ONCE —
  // only its sha-256 hash is stored here (never the raw token). Re-registering
  // replaces the hash (old token stops working); revoke clears all three.
  deviceBridge: {
    tokenHash: {type:String,default:null},
    registeredAt: {type:Date,default:null},
    registeredBy: {type:String,default:null},
  },
}, {timestamps:true,strict:'throw',autoIndex:false});
schema.index({tenant:1,location:1},{unique:true});
schema.index({tenant:1,slug:1},{unique:true,partialFilterExpression:{slug:{$type:'string'}}});
module.exports = model('VenueLocationProfile',schema);
