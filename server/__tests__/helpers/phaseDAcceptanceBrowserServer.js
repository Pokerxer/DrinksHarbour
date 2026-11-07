'use strict';
// Disposable synthetic API only. Never startup/dotenv/providers/messages.
const express=require('express'),jwt=require('jsonwebtoken'),path=require('node:path');
const {connectVenueMongo}=require('./venueMongo');
async function main(){
 const cleanup=[];await connectVenueMongo({after:fn=>cleanup.push(fn)},'phase_d_browser');
 const {f,child,actor,driver,booking,service}=await require('./merchantRecoveryFixture').fixture({after:fn=>cleanup.push(fn)});
 process.env.JWT_SECRET='phase-d-browser-synthetic-only';
 process.env.MERCHANT_REFUNDS_ENABLED='false';process.env.MERCHANT_PAYSTACK_REFUNDS_ENABLED='false';process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED='false';
 const engine=require('../../services/delivery.service');
 const shipped=await engine.dispatchManagedDelivery(booking._id,{expectedVersion:booking.version,idempotencyKey:'browser-original-dispatch'},actor);
 await engine.resolveManagedDelivery(booking._id,{expectedVersion:shipped.version,idempotencyKey:'browser-original-fail',status:'failed',failureReason:'Synthetic recipient unavailable'},actor);
 await service.revokeContract(String((await require('../../models/MerchantDispatchBooking').findById(booking._id)).contractSnapshot._id),f.admin);
 process.env.MERCHANT_LOCAL_DISPATCH_ENABLED='false';
 const User=require('../../models/User'),Tenant=require('../../models/Tenant');
 const customer={_id:String(f.customer),role:'customer',firstName:'Synthetic',lastName:'Buyer',email:'phase-d-buyer@example.test',isEmailVerified:true,isAgeVerified:true};
 await User.collection.updateOne({_id:f.customer},{$set:{firstName:customer.firstName,lastName:customer.lastName,email:customer.email,isEmailVerified:true,isAgeVerified:true}});
 for(const [index,tenant] of f.tenants.entries())await Tenant.collection.updateOne({_id:tenant._id},{$set:{name:`Synthetic recovery shop ${index+1}`,slug:`synthetic-recovery-shop-${index+1}`}});
 const sign=id=>jwt.sign({userId:String(id)},process.env.JWT_SECRET,{expiresIn:'1h'});
 const {encode}=require(path.resolve(__dirname,'../../../client/apps/admin/node_modules/next-auth/jwt'));
 const cookie=await encode({secret:'phase-d-browser-session-only',token:{id:String(actor._id),role:actor.role,tenantId:String(actor.tenant),accessToken:sign(actor._id),name:'Synthetic Merchant',email:'phase-d-merchant@example.test',plan:'pro',subscriptionStatus:'active'}});
 const originalBudget=await require('../../models/MerchantDispatchBudget').findById(child._id).lean();
 const app=express();app.use((req,res,next)=>{
  if(['http://127.0.0.1:39142','http://127.0.0.1:39143'].includes(req.headers.origin)){
   res.set('Access-Control-Allow-Origin',req.headers.origin);res.set('Access-Control-Allow-Credentials','true');res.set('Access-Control-Allow-Headers','Authorization,Content-Type,x-csrf-token');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  }
  if(req.method==='OPTIONS')return res.sendStatus(204);next();
 });app.use(express.json());
 const carrier=require('./phaseDBrowserCarrier')(app,{f,child,actor});cleanup.push(carrier.restore);
 app.get('/__test/state',(req,res)=>res.json({cookie,child:String(child._id),driver:String(driver._id),orderId:String(f.order._id),customer,customerToken:sign(f.customer)}));
 app.get('/__test/summary',async(req,res,next)=>{try{
  const own=await require('../../models/MerchantOrder').findById(child._id).lean(),stock=await require('../../models/WarehouseStock').findOne({tenant:child.tenant,size:child.lines[0].size}).lean(),
   budget=await require('../../models/MerchantDispatchBudget').findById(child._id).lean(),saved=await require('../../models/MerchantDispatchBooking').findById(booking._id).lean();
  res.json({...await carrier.summary(),state:saved.state,stock:stock.currentQuantity,reserved:stock.reservedQuantity,progress:own.quantityProgress,
   allocations:await require('../../models/MerchantShipmentAllocation').countDocuments({merchantOrder:child._id}),trips:await require('../../models/Delivery').countDocuments({tenant:child.tenant,responsibilityVersion:2}),
   receipts:await require('../../models/MerchantDeliveryReturn').countDocuments({merchantOrder:child._id}),budgetUnchanged:JSON.stringify(budget)===JSON.stringify(originalBudget),
   creationEnabled:process.env.MERCHANT_LOCAL_DISPATCH_ENABLED==='true',contractState:(await require('../../models/MerchantLocalDispatchContract').findOne({tenant:child.tenant})).status,
  });
 }catch(error){next(error);}});
 const {protect}=require('../../middleware/auth.middleware');
 app.get('/api/users/me',protect,(req,res)=>res.json({success:true,data:{user:{_id:String(req.user._id),role:req.user.role,firstName:req.user.firstName,lastName:req.user.lastName,email:req.user.email}}}));
 app.use('/api/orders',require('../../routes/order.routes'));app.use('/api',require('../../routes/merchant-operations.routes'));app.use('/api',require('../../routes/customer-order-operations.routes'));
 app.use((err,req,res,next)=>res.status(err.statusCode||500).json({success:false,message:err.message}));
 const server=app.listen(39140,'127.0.0.1',()=>console.log('Phase D recovery browser fixture ready'));
 let closing=false;async function close(){if(closing)return;closing=true;await new Promise(resolve=>server.close(resolve));for(const fn of cleanup.reverse())await fn();process.exit(0);}
 process.on('SIGTERM',close);process.on('SIGINT',close);
}
main().catch(error=>{console.error(error);process.exit(1);});
