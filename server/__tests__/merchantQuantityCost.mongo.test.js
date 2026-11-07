'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mongoose=require('mongoose'),{uri,connectVenueMongo}=require('./helpers/venueMongo');
test('V2 goods cancellation reverses only never-shipped original cost unit ranges with atomic replay evidence',{skip:!uri},async t=>{
 const filename=path.resolve(__dirname,'../services/merchantFulfillment/quantity/goodsCancellation.js');
 const module=fs.existsSync(filename)?require(filename):{};assert.equal(typeof module.cancelQuantityGoodsAccounting,'function','V2 exact cost command exists');
 await connectVenueMongo(t,'merchant_quantity_cost');const oid=()=>new mongoose.Types.ObjectId();
 const Order=require('../models/Order'),Child=require('../models/MerchantOrder'),Hold=require('../models/OnlineStockReservation'),Journal=require('../models/JournalEntry');
 const tenant=oid(),parent=oid(),actor={_id:oid(),role:'super_admin'},line=oid();
 const item={_id:oid(),fulfillmentLineId:line,tenant,warehouse:oid(),product:oid(),subproduct:oid(),size:oid(),quantity:3,itemSubtotal:30,
   tenantRevenueShare:24,platformCommission:6,vendorPriceAtPurchase:3.336};
 const raw={_id:parent,merchantFulfillmentVersion:2,settlementOwner:'platform',source:'web',currency:'NGN',items:[item],subtotal:30,totalAmount:30};
 await Order.collection.insertOne(raw);const [allocation]=require('../services/merchantFulfillment/allocation').allocate(raw);
 const child=await Child.create({...allocation,fulfillmentVersion:2,quantityProgress:[{line:String(line),financialBlocks:[{start:0,quantity:3,refund:oid(),kind:'refunded'}]}]});
 const hold=await Hold.create({_id:'original-cost-units',order:parent,tenant,warehouse:item.warehouse,product:item.product,subProduct:item.subproduct,size:item.size,
   quantity:3,state:'reserved',reservationVersion:2,merchantOrder:child._id,fulfillmentLineId:String(line),consumedQuantity:0,releasedQuantity:0,unitDispositions:[]});
 await require('../services/chartOfAccounts.service').ensureDefaultCOA(tenant);
 await require('../services/journalEntry.service').postJournalEntry({tenantId:tenant,refDoc:parent,entryType:'cogs',source:'marketplace',lines:[{account:'5000',debit:10.01},{account:'1200',credit:10.01}]});
 const first=oid(),second=oid();
 async function run(allocationId,ranges,{rollback=false}={}){
   const session=await mongoose.startSession();try{return await session.withTransaction(async()=>{
     await module.cancelQuantityGoodsAccounting({parent:await Order.findById(parent).session(session),child:await Child.findById(child._id).session(session),
       lines:[{line:String(line),ranges}],allocationId,actor,session});if(rollback)throw Error('Synthetic stock release failed');
   });}finally{await session.endSession();}
 }
 await run(first,[{start:1,quantity:1}]);await run(first,[{start:1,quantity:1}]);
 let entries=await Journal.find({source:'merchant_goods_cancel'}).lean();assert.equal(entries.length,1);assert.equal(entries[0].lines.find(l=>l.account==='1200').debit,3.34);
 await assert.rejects(run(oid(),[{start:1,quantity:1}]),{statusCode:409});
 await assert.rejects(run(first,[{start:0,quantity:1}]),{statusCode:409});
 await assert.rejects(run(second,[{start:2,quantity:1}],{rollback:true}),/stock release failed/);
 assert.equal(await Journal.countDocuments({refDoc:second}),0);
 await run(second,[{start:2,quantity:1}]);entries=await Journal.find({source:'merchant_goods_cancel'}).lean();assert.equal(entries.reduce((n,e)=>n+Math.round(e.lines.find(l=>l.account==='1200').debit*100),0),667);
 await Hold.updateOne({_id:hold._id},{$set:{consumedQuantity:1,unitDispositions:[{start:0,quantity:1,action:'consume',allocation:'synthetic-shipment'}]}});
 await assert.rejects(run(oid(),[{start:0,quantity:1}]),{statusCode:409},'shipped units cannot get goods cancellation cost reversal');
 assert.equal(await Journal.countDocuments({source:'merchant_goods_cancel'}),2);
 assert.equal((await require('../models/MerchantGoodsCancellation').findOne({order:parent})).cancellations.length,2);
});
