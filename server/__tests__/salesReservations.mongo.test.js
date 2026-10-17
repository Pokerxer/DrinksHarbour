const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const uri=process.env.DRINKSHARBOUR_SALES_RESERVATION_TEST_MONGO_URI;
test('reservations: concurrent confirmation, retry, top-up and tenant boundaries', {skip:!uri},async t=>{
 assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:29127\/drinks_sales_reservation_test_[\w]+(?:\?.*)?$/);
 await mongoose.connect(uri,{serverSelectionTimeoutMS:5000});
 t.after(async()=>{await mongoose.connection.dropDatabase();await mongoose.disconnect();});
 const SalesOrder=require('../models/SalesOrder');
 const Stock=require('../models/WarehouseStock');
 const Reservation=require('../models/SalesStockReservation');
 const Operation=require('../models/SalesOrderOperation');
 const Warehouse=require('../models/Warehouse');
 const SP=require('../models/SubProduct');
 const Size=require('../models/Size');
 await Promise.all([Reservation.init(),Operation.init(),Stock.init(),require('../models/Order').init(),require('../models/Sales').init(),require('../models/POSCustomer').init(),require('../models/WalletTransaction').init()]);
 const oid=()=>new mongoose.Types.ObjectId();
 const tenant=oid(),foreign=oid(),wh=oid(),sp=oid(),size=oid(),actor=oid(),product=oid();
 await Warehouse.collection.insertOne({_id:wh,tenant,isActive:true,isDefault:true,name:'Main'});
 await SP.collection.insertOne({_id:sp,tenant,product,defaultSize:size,sizes:[size],totalStock:10});
 await Size.collection.insertOne({_id:size,tenant,subproduct:sp,stock:10});
 await Stock.create({tenant,warehouse:wh,subProduct:sp,size,currentQuantity:10});
 const makeOrder=async(name,qty=8)=>{const _id=oid(); await SalesOrder.collection.insertOne({_id,tenant,createdAt:new Date(),updatedAt:new Date(),soNumber:name,docType:'quotation',quoteStatus:'draft',warehouseId:wh,items:[{_id:oid(),subproduct:sp,size,quantity:qty,unitPrice:10,lineTotal:qty*10,fulfilledQty:0,postedQty:0,lineType:'product'}],subtotal:qty*10,total:qty*10,amountPaid:0,paymentStatus:'unpaid',currency:'NGN',fulfillments:[]});return _id;};
 const a=await makeOrder('RES-A'),b=await makeOrder('RES-B');
 const service=require('../services/salesReservations');
 const args=id=>({tenantId:tenant,orderId:id,warehouseId:wh,actorId:actor});
 await Promise.all([service.confirmReservation(args(a)),service.confirmReservation(args(b))]);
 let rows=await Reservation.find({tenant}).lean();
 assert.equal(rows.reduce((sum,r)=>sum+r.heldQty,0),10);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,10);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,10);
 await service.confirmReservation(args(a));
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,10);
 const [view]=await service.projectReservations([await SalesOrder.findOne({_id:a,tenant}).lean()],tenant);
 assert.equal(view.orderStatus,'confirmed');assert.equal(view.paymentStatus,'unpaid');assert.equal(view.amountPaid,0);
 assert.equal(view.items[0].reservedQty+view.items[0].waitingQty,8);
 await Stock.updateOne({tenant,warehouse:wh},{$inc:{currentQuantity:6}});
 await Promise.all([service.checkAvailability(args(a)),service.checkAvailability(args(b))]);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,16);
 await service.checkAvailability(args(b));
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,16);
 await assert.rejects(service.confirmReservation({...args(a),tenantId:foreign}),/not found/i);
 assert.equal(await require('../models/JournalEntry').countDocuments({tenant}),0);
 // Duplicate lines split a shared row rather than oversubscribing it.
 const c=await makeOrder('RES-C',2);
 const doc=await SalesOrder.findOne({_id:c,tenant});
 doc.items.push({...doc.items[0].toObject(),_id:oid()});await doc.save();
 await Stock.updateOne({tenant,warehouse:wh},{$inc:{currentQuantity:3}});
 await service.confirmReservation(args(c));
 rows=await Reservation.find({tenant,salesOrder:c}).lean();
 assert.equal(rows.reduce((sum,r)=>sum+r.heldQty,0),3);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,19);
 const warehouseService=require('../services/warehouse.service');
 await assert.rejects(warehouseService.sellStock({warehouseId:wh,subProduct:sp,size,quantity:1},actor,tenant),/reserved|insufficient/i);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,19);
 await Stock.updateOne({tenant,warehouse:wh},{$inc:{reservedQuantity:2}}); // independent quarantine hold
 await service.cancelReservedOrder(args(c));
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,18);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,19);
 await service.cancelReservedOrder(args(c));
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,18);
 const lineA=(await SalesOrder.findOne({_id:a,tenant})).items[0]._id;
 const shipment={...args(a),items:[{lineId:String(lineA),qty:3}],requestId:'shipment-one'};
 await SalesOrder.updateOne({_id:a,tenant},{$set:{locked:true}});
 await Promise.all([service.fulfillReservedOrder(shipment),service.fulfillReservedOrder(shipment)]);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,16);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).reservedQuantity,15);
 assert.equal((await Reservation.findOne({tenant,salesOrder:a})).heldQty,5);
 assert.equal(await require('../models/Sales').countDocuments({tenant}),1);
 await assert.rejects(service.fulfillReservedOrder({...shipment,items:[{lineId:String(lineA),qty:2}]}),/request|different|conflict/i);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,16);
 // Explicit payment claims serialize charging independently of stock confirmation.
 const payment=require('../services/salesReservations/payment');
 let charges=0;
 const payArgs={...args(b),payment:{paymentMethod:'cash'},capture:async()=>{charges++;return {ok:true};}};
 await Promise.allSettled([payment.recordPayment(payArgs),payment.recordPayment(payArgs)]);
 await payment.recordPayment(payArgs);
 assert.equal(charges,1);assert.equal((await SalesOrder.findOne({_id:b,tenant})).amountPaid,80);
 const failedOrder=await makeOrder('RES-PAY-FAIL',1);await service.confirmReservation(args(failedOrder));
 await assert.rejects(payment.recordPayment({...args(failedOrder),payment:{paymentMethod:'wallet'},capture:async()=>({ok:false,message:'Insufficient wallet funds'})}),/funds/);
 assert.equal((await SalesOrder.findOne({_id:failedOrder,tenant})).orderStatus,'confirmed');
 assert.equal((await SalesOrder.findOne({_id:failedOrder,tenant})).amountPaid,0);
 const posService=require('../services/salesReservations/pos');
 const posArgs={tenantId:tenant,orderId:a,actorId:actor,warehouseId:wh,requestId:'pos-request-one',payload:{quantity:2,paymentMethod:'cash'}};
 const ctx=await posService.beginPOSSale(posArgs);
 await ctx.consumeLine({subProductId:sp,sizeId:size,quantity:2});
 const receipt=await ctx.createReceipt({placedAt:new Date(),orderNumber:'LOCAL-POS-1',receiptNumber:'RCP-RES-1',tenant,source:'pos',linkedSalesOrder:a,items:[{product,subproduct:sp,size,tenant,quantity:2,priceAtPurchase:10,itemSubtotal:20}],subtotal:20,totalAmount:20,paymentMethod:'cash',paymentStatus:'paid',status:'confirmed'});
 await ctx.commitReceipt(receipt);
 await ctx.close();
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,14);
 assert.equal((await Reservation.findOne({tenant,salesOrder:a})).heldQty,3);
 assert.equal((await SalesOrder.findOne({_id:a,tenant})).amountPaid,20);
 const replay=await posService.beginPOSSale(posArgs);
 assert.equal(replay.duplicate,true);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,14);
 await assert.rejects(posService.beginPOSSale({...posArgs,payload:{quantity:3}}),/different/i);
 // Failed POS sale aborts its tentative consumption and retains the hold.
 const aborted=await posService.beginPOSSale({...posArgs,requestId:'pos-request-abort',payload:{quantity:1}});
 const customerId=oid();const Customer=require('../models/POSCustomer');
 await Customer.collection.insertOne({_id:customerId,tenant,walletBalance:100});
 const walletArgs={owner:{Model:Customer,ownerType:'POSCustomer',ownerId:customerId,filter:{_id:customerId,tenant}},tenantId:tenant,
   value:{type:'debit',amount:10,reason:'Reserved POS transaction test'},reference:'RES-ABORT'};
 await aborted.consumeLine({subProductId:sp,sizeId:size,quantity:1});
 try { await aborted.mutateWallet(walletArgs); } finally { await aborted.close(); }
 assert.equal((await Customer.findOne({_id:customerId,tenant})).walletBalance,100);
 assert.equal(await require('../models/WalletTransaction').countDocuments({tenant,ownerId:customerId}),0);
 assert.equal((await Stock.findOne({tenant,warehouse:wh})).currentQuantity,14);
 assert.equal((await Reservation.findOne({tenant,salesOrder:a})).heldQty,3);
 // New location, legacy missing counter, default size, validation and rollback.
 const wh2=oid(),wh3=oid();
 await Warehouse.collection.insertMany([{_id:wh2,tenant,isActive:true,name:'Second',code:'SECOND'},{_id:wh3,tenant:foreign,isActive:true,name:'Foreign',code:'FOREIGN'}]);
 await Stock.collection.insertOne({tenant,warehouse:wh2,subProduct:sp,size,currentQuantity:10});
 const edge=await makeOrder('RES-EDGE',4);
 await SalesOrder.updateOne({_id:edge,tenant},{$unset:{'items.0.size':1}});
 await service.confirmReservation({...args(edge),warehouseId:wh2});
 assert.equal(String((await SalesOrder.findOne({_id:edge,tenant})).items[0].size),String(size));
 assert.equal((await Stock.findOne({tenant,warehouse:wh2})).reservedQuantity,4);
 await assert.rejects(warehouseService.adjustStock({warehouseId:wh2,subProduct:sp,size,quantity:3,type:'adjusted'},actor,tenant),/reserved/i);
 await assert.rejects(warehouseService.transferStock({fromWarehouse:wh2,toWarehouse:wh,subProduct:sp,size,quantity:7},actor,tenant),/reserved/i);
 await assert.rejects(warehouseService.sellStock({warehouseId:wh2,subProduct:sp,size,quantity:7,allowOverselling:true},actor,tenant),/reserved/i);
 const edgeLine=String((await SalesOrder.findOne({_id:edge,tenant})).items[0]._id);
 const edgeShip={...args(edge),warehouseId:wh2,requestId:'edge-rollback',items:[{lineId:edgeLine,qty:1},{lineId:String(oid()),qty:1}]};
 await assert.rejects(service.fulfillReservedOrder(edgeShip),/line not found/i);
 assert.equal((await Stock.findOne({tenant,warehouse:wh2})).currentQuantity,10);
 assert.equal((await Reservation.findOne({tenant,salesOrder:edge})).heldQty,4);
 assert.equal(await Operation.countDocuments({tenant,salesOrder:edge,requestId:'edge-rollback'}),0);
 await assert.rejects(service.fulfillReservedOrder({...edgeShip,warehouseId:wh3,requestId:'edge-foreign',items:[{lineId:edgeLine,qty:1}]}),/warehouse/i);
 // Shipping at another location releases only corresponding original hold.
 await Stock.updateOne({tenant,warehouse:wh},{$inc:{currentQuantity:2}});
 await service.fulfillReservedOrder({...edgeShip,warehouseId:wh,requestId:'edge-moved-shipment',items:[{lineId:edgeLine,qty:1}]});
 assert.equal((await Reservation.findOne({tenant,salesOrder:edge,warehouse:wh2})).heldQty,3);
 assert.equal((await Stock.findOne({tenant,warehouse:wh2})).reservedQuantity,3);
 const invalid=await makeOrder('RES-INVALID',1);
 await SalesOrder.updateOne({_id:invalid,tenant},{$push:{items:{_id:oid(),lineType:'product',subproduct:oid(),size,quantity:1}}});
 await assert.rejects(service.confirmReservation({...args(invalid),warehouseId:wh2}),/product/i);
 assert.equal(await Reservation.countDocuments({tenant,salesOrder:invalid}),0);
 // Expired quarantine is counted once; unquarantined expired units stay unavailable.
 await require('../models/Tenant').collection.insertOne({_id:tenant,warehouseSettings:{blockExpiredStock:true}});
 await require('../models/WarehouseBatch').collection.insertMany([
  {tenant,warehouse:wh2,subProduct:sp,size,batchNumber:'expired-held',quantity:2,quarantined:true,expiryDate:new Date(0)},
  {tenant,warehouse:wh2,subProduct:sp,size,batchNumber:'expired-free',quantity:1,quarantined:false,expiryDate:new Date(0)}]);
 await Stock.updateOne({tenant,warehouse:wh2},{$inc:{reservedQuantity:2}});
 const expiry=await makeOrder('RES-EXPIRY',8);await service.confirmReservation({...args(expiry),warehouseId:wh2});
 assert.equal((await Reservation.findOne({tenant,salesOrder:expiry})).heldQty,4); //10-3-2-1
 await service.cancelReservedOrder(args(expiry));
 assert.equal((await Stock.findOne({tenant,warehouse:wh2})).reservedQuantity,5); // original3 + quarantine2
 const uncertain=await makeOrder('RES-UNCERTAIN',1);await service.confirmReservation({...args(uncertain),warehouseId:wh2});
 let attempts=0;
 const uncertainPay={...args(uncertain),payment:{paymentMethod:'wallet'},capture:async()=>{attempts++;throw new Error('Lost tender response');}};
 await assert.rejects(payment.recordPayment(uncertainPay),/review/i);
 await assert.rejects(payment.recordPayment(uncertainPay),/review/i);assert.equal(attempts,1);
 await assert.rejects(service.cancelReservedOrder(args(uncertain)),/review/i);
 await assert.rejects(posService.beginPOSSale({...posArgs,orderId:uncertain,warehouseId:wh2,requestId:'pos-uncertain-payment'}),/review/i);

 // Final delivery owns immutable attribution; previous partial actors do not.
 const deliveryUser={_id:oid(),firstName:'Warehouse',lastName:'Completer'};
 const staleB=await SalesOrder.findOne({_id:b,tenant});
 const bLine=String((await SalesOrder.findOne({_id:b,tenant})).items[0]._id);
 await service.fulfillReservedOrder({...args(b),actor:deliveryUser,actorId:deliveryUser._id,
   requestId:'final-manual',items:[{lineId:bLine,qty:8}]});
 let completed=await SalesOrder.findOne({_id:b,tenant});
 assert.equal(completed.fulfillmentAttribution.name,'Warehouse Completer');
 assert.equal(String(completed.salespersonUser),String(deliveryUser._id));
 completed.salesperson='Tampered';
 await assert.rejects(completed.save(),/attribution.*locked/i);
 const blocked=await SalesOrder.updateOne({_id:b,tenant},{$set:{salesperson:'Tampered'}});
 assert.equal(blocked.matchedCount,0);
 const unset=await SalesOrder.updateOne({_id:b,tenant},{$unset:{fulfillmentAttribution:1}});
 assert.equal(unset.matchedCount,0);
 completed=await SalesOrder.findOne({_id:b,tenant});
 assert.equal(completed.salesperson,'Warehouse Completer');
 staleB.salesperson='Late editor';staleB.salespersonUser=oid();
 await assert.rejects(staleB.save(),/No document found|not found|attribution.*locked/i);
 assert.equal((await SalesOrder.findOne({_id:b,tenant})).salesperson,'Warehouse Completer');
 completed.notes='Later operational note';completed.$locals.skipSalesInvoiceSync=true;
 await completed.save();
 assert.equal(completed.fulfillmentAttribution.name,'Warehouse Completer');

 const cashier={_id:oid(),firstName:'Final',lastName:'Cashier'};
 const finalArgs={...posArgs,actor:cashier,actorId:cashier._id,requestId:'final-pos',payload:{quantity:3,paymentMethod:'cash'}};
 const finalPOS=await posService.beginPOSSale(finalArgs);
 await finalPOS.consumeLine({subProductId:sp,sizeId:size,quantity:3});
 const finalReceipt=await finalPOS.createReceipt({placedAt:new Date(),orderNumber:'LOCAL-POS-FINAL',receiptNumber:'RCP-RES-FINAL',
   tenant,source:'pos',posStaff:cashier._id,linkedSalesOrder:a,items:[{product,subproduct:sp,size,tenant,quantity:3,priceAtPurchase:10,itemSubtotal:30}],
   subtotal:30,totalAmount:30,paymentMethod:'cash',paymentStatus:'paid',status:'confirmed'});
 await finalPOS.commitReceipt(finalReceipt);await finalPOS.close();
 completed=await SalesOrder.findOne({_id:a,tenant});
 assert.equal(completed.orderStatus,'fulfilled');
 assert.equal(completed.fulfillmentAttribution.name,'Final Cashier');
 assert.equal(String(completed.salespersonUser),String(cashier._id));
 const finalReplay=await posService.beginPOSSale({...finalArgs,actor:deliveryUser,actorId:deliveryUser._id});
 assert.equal(finalReplay.duplicate,true);
 assert.equal((await SalesOrder.findOne({_id:a,tenant})).fulfillmentAttribution.name,'Final Cashier');

});
