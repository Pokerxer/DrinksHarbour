'use strict';
const router=require('express').Router(),service=require('../services/deliveryProviders/external'),asyncHandler=require('../utils/asyncHandler');
// Raw bytes are captured by the production JSON parser before this route.
router.post('/webhooks/:account',asyncHandler(async(req,res)=>{res.set('Cache-Control','private, no-store');await service.webhook(req.params.account,req.rawBody,req.get('x-ship-signature'));res.json({success:true});}));
const {protect,authorize}=require('../middleware/auth.middleware');
router.use(protect,authorize('super_admin','admin','tenant_owner','tenant_admin','tenant_staff'));
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
router.get('/orders/:id',asyncHandler(async(req,res)=>res.json({success:true,data:await service.getOptions(req.params.id,req.user)})));
router.post('/reviews',asyncHandler(async(req,res)=>res.status(201).json({success:true,data:{review:await service.reviewCarrier(req.body,req.user)}})));
router.post('/reviews/:id/revoke',asyncHandler(async(req,res)=>res.json({success:true,data:{review:await service.revokeReview(req.params.id,req.user)}})));
router.post('/orders/:id/quotes',asyncHandler(async(req,res)=>res.status(201).json({success:true,data:{quote:await service.quoteCarrier(req.params.id,req.body,req.user)}})));
router.post('/orders/:id/bookings',asyncHandler(async(req,res)=>res.json({success:true,data:{booking:await service.bookCarrier(req.params.id,req.body,req.user)}})));
router.get('/bookings/:id',asyncHandler(async(req,res)=>res.json({success:true,data:{booking:await service.getBooking(req.params.id,req.user)}})));
for(const action of ['refresh','cancel','reconcile'])router.post(`/bookings/:id/${action}`,asyncHandler(async(req,res)=>res.json({success:true,data:{booking:await service[action](req.params.id,...(action==='refresh'?[]:[req.body]),req.user)}})));
module.exports=router;
