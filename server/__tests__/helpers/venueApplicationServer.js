'use strict';
// Disposable application integration host. Never reads .env or the application DB.
process.env.JWT_SECRET='venue-application-test-jwt';
process.env.VENUE_EXPERIENCE_ENABLED='true';process.env.VENUE_CHANNEL_SECRET='venue-application-test-channel';
const express=require('express');const cookieParser=require('cookie-parser');const cors=require('cors');const jwt=require('jsonwebtoken');const mongoose=require('mongoose');
const {connectVenueMongo,fixture,beverage}=require('./venueMongo');
async function main(){
 let cleanup;await connectVenueMongo({after:fn=>{cleanup=fn;}},'application');
 const args=await fixture();const line=await beverage(args);const Tenant=require('../../models/Tenant');const User=require('../../models/User');
 await Tenant.collection.updateOne({_id:new mongoose.Types.ObjectId(args.tenantId)},{$set:{name:'Application Lounge',slug:'application-lounge',city:'Abuja',businessCapabilities:['hospitality','retail'],'venueSettings.publicListed':true,'venueSettings.requestBookingsEnabled':true}});
 await require('../../models/Warehouse').updateOne({_id:args.locationId},{$addToSet:{'venueServices.capabilities':'request_bookings'}});
 await User.collection.updateOne({_id:new mongoose.Types.ObjectId(args.actor.userId)},{$set:{firstName:'Venue',lastName:'Manager',email:'manager@venue.test'}});
 const customerId=new mongoose.Types.ObjectId();await User.collection.insertOne({_id:customerId,role:'customer',status:'active',firstName:'Browser',lastName:'Guest',email:'guest@venue.test',phoneNumber:'+234123456789',isEmailVerified:true,isAgeVerified:true});
 const sp=await require('../../models/SubProduct').findOne({_id:line.subProductId}).lean();
 await require('../../models/Product').collection.updateOne({_id:sp.product},{$set:{status:'approved',isPublished:true,abv:5}});
 await require('../../models/Size').collection.updateOne({_id:new mongoose.Types.ObjectId(line.sizeId)},{$set:{size:'75cl',displayName:'75cl'}});
 const Config=require('../../models/VenueLocationProfile');await Config.createIndexes();
 await Config.create({tenant:args.tenantId,location:args.locationId,slug:'main',version:1,profileVersion:1,reviewedProfileVersion:1,reviewedAt:new Date(),reviewedBy:args.actor.userId,
  profile:{slug:'main',name:'Main lounge',types:['lounge'],timezone:'Africa/Lagos',description:'Disposable application test venue',address:'Abuja test location',hours:[{day:5,opens:'18:00',closes:'02:00',overnight:true}],exceptions:[],policies:'Table requests await staff review. No deposit.'},
  menu:{sections:[{id:'drinks',name:'Drinks',items:[{subProductId:line.subProductId,sizeId:line.sizeId,published:true}]}]},floor:{zones:[{id:'main',name:'Main room'}],tables:[{tableId:args.tableIds[0],zone:'main',x:20,y:20,shape:'round'}]}});
 // Earlier stale publication candidates must not hide the live location from list/home pages.
 const noise=Array.from({length:610},(_,i)=>({_id:new mongoose.Types.ObjectId((i+1).toString(16).padStart(24,'0')),tenant:i<300?new mongoose.Types.ObjectId():new mongoose.Types.ObjectId(args.tenantId),location:new mongoose.Types.ObjectId(),slug:`stale-${i}`,version:2,profileVersion:2,reviewedProfileVersion:1,reviewedAt:new Date(),reviewedBy:args.actor.userId,profile:{slug:`stale-${i}`,name:'Stale unpublished location',timezone:'Africa/Lagos',types:['lounge']}}));
 await Config.collection.insertMany(noise);
 await require('../../services/venue/service-sessions').ensureIndexes();
 const strangerId=new mongoose.Types.ObjectId();await User.collection.insertOne({_id:strangerId,role:'customer',status:'active'});
 const strangerToken=jwt.sign({userId:String(strangerId)},process.env.JWT_SECRET,{expiresIn:'2h'});
 const customerToken=jwt.sign({userId:String(customerId)},process.env.JWT_SECRET,{expiresIn:'2h'});const staffToken=jwt.sign({userId:args.actor.userId},process.env.JWT_SECRET,{expiresIn:'2h'});
 const {encode}=require('../../../client/apps/admin/node_modules/next-auth/jwt');
 const adminCookie=await encode({secret:'venue-application-nextauth-test',token:{id:args.actor.userId,name:'Venue Manager',email:'manager@venue.test',role:'tenant_owner',tenantId:args.tenantId,tenantSlug:'application-lounge',plan:'venue',subscriptionStatus:'active',accessToken:staffToken},maxAge:7200});
 const app=express();app.use(cookieParser());app.use(express.json());
 app.use(cors({...require('../../config/cors').corsOptions,origin:['http://127.0.0.1:39131','http://127.0.0.1:39132','http://application-lounge.localhost:39131']}));
 const phase2=await require('./venuePhase2Application').setupPhase2(app);
 const catalogCosting=await require('./venueCatalogCostingApplication').setupCatalogCostingApplication(app);
 app.get('/__test/state',(req,res)=>res.json({catalogCosting,phase2:{...phase2,wall:new Date(Date.now()+70*60000).toISOString().slice(0,16)},args,customerToken,strangerToken,staffToken,adminCookie,customer:{_id:String(customerId),firstName:'Browser',lastName:'Guest',email:'guest@venue.test',role:'customer',isEmailVerified:true,isAgeVerified:true,phoneNumber:'+234123456789'}}));
 app.post('/__test/subscription/:mode',async(req,res)=>{if(!['canceled','active'].includes(req.params.mode))return res.sendStatus(400);await Tenant.updateOne({_id:args.tenantId},{$set:req.params.mode==='canceled'?{plan:'starter',subscriptionStatus:'canceled',venueSubscriptionReadOnlySince:new Date()}:{plan:'venue',subscriptionStatus:'active',venueSubscriptionReadOnlySince:null}});res.json({updated:true});});
 app.get('/__test/summary',async(req,res)=>res.json({bookings:await require('../../models/Booking').countDocuments({tenant:args.tenantId}),visits:await require('../../models/VenueServiceSession').countDocuments({tenant:args.tenantId}),orders:await require('../../models/Order').countDocuments({tenant:args.tenantId})}));
 app.use('/api/venue-experience',require('../../routes/venue-experience.routes'));
 app.use('/api/venue-ops',require('../../routes/venue-ops.routes'));
 const {protect,allowBillingWrites,authorize,attachTenant,requireTenant}=require('../../middleware/auth.middleware');
 app.get('/api/erm/status',allowBillingWrites,protect,authorize('tenant_owner','tenant_admin','tenant_staff'),attachTenant,requireTenant,require('../../utils/asyncHandler')(require('../../controllers/erm.controller').getStatus));
 app.get('/api/users/me',protect,(req,res)=>res.json({success:true,data:{user:req.user}}));
 app.get('/api/users/me/permissions',protect,(req,res)=>res.json({success:true,data:{permissions:[]}}));
 app.get('/api/tenants/slug/:slug',async(req,res)=>{const tenant=await Tenant.findOne({slug:req.params.slug}).select('_id name slug plan subscriptionStatus status businessCapabilities venueSettings defaultCurrency').lean();res.status(tenant?200:404).json({success:!!tenant,data:{tenant}});});
 // Unrelated global chrome has no external fixtures or outbound effects.
 app.get('/api/banners/placement/:placement',(req,res)=>res.json({success:true,data:[]}));
 app.get('/api/settings/public',(req,res)=>res.json({success:true,data:{}}));
 app.get('/api/cart',(req,res)=>res.json({success:true,data:{items:[]}}));
 app.get('/api/categories',(req,res)=>res.json({success:true,data:[]}));
 app.get('/api/products/filter-options',(req,res)=>res.json({success:true,data:{}}));
 app.use((req,res)=>res.status(404).json({success:false,message:'No integration fixture for this unrelated endpoint'}));
 app.use((err,req,res,next)=>res.status(err.statusCode||500).json({success:false,message:err.message,code:err.code}));
 const server=app.listen(39130,'127.0.0.1',()=>console.log('Disposable venue application API ready on39130'));
 let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await new Promise(resolve=>server.close(resolve));await cleanup();process.exit(0);};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;mongoose.disconnect();});
