'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('shared managed identity distinguishes both accepted versions from independent legacy workflows',()=>{
 const source=path.resolve(__dirname,'../services/merchantFulfillment/identity.js');
 const identity=fs.existsSync(source)?require(source):{};
 assert.equal(typeof identity.managed,'function');
 for(const version of [1,2]){assert.equal(identity.managed({merchantFulfillmentVersion:version}),true);assert.throws(()=>identity.assertLegacy({merchantFulfillmentVersion:version}),error=>error.statusCode===409);}
 for(const order of [{},{onlineStockVersion:1},{source:'pos'},{integrationCheckout:'website'},{venueIdentityVersion:1}])assert.equal(identity.managed(order),false);
 assert.deepEqual(identity.legacyFilter(),{merchantFulfillmentVersion:{$nin:[1,2]}});
});
test('both parent lifecycle entry points reject managed quantities before any session or stock command',async t=>{
 const mongoose=require('mongoose');let sessions=0;
 t.mock.method(mongoose,'startSession',async()=>{sessions++;throw new Error('Legacy session must not start');});
 for(const version of [1,2])for(const service of [require('../services/orderStatus.service').applyOrderStatus,require('../services/storefrontLocationOrders').applyStatus]){
  await assert.rejects(()=>service({_id:'650000000000000000000004',onlineStockVersion:1,merchantFulfillmentVersion:version},'shipped'),error=>error.statusCode===409);
 }
 assert.equal(sessions,0);
});
test('managed version2 cannot use legacy whole-parent collection or monetary refund',async t=>{
 const Order=require('../models/Order'),Claim=require('../models/MarketplacePaymentClaim'),access=require('../services/orderAccess');let writes=0,lookups=0;
 t.mock.method(Order,'findById',async()=>({_id:'650000000000000000000004',merchantFulfillmentVersion:2,status:'confirmed',paymentStatus:'pending',paymentMethod:'cash_on_delivery',items:[],save:async()=>{writes++;}}));
 t.mock.method(Claim,'findOne',()=>{lookups++;throw new Error('Legacy provider lookup forbidden');});t.mock.method(access,'audit',async()=>{});
 const actor={_id:'650000000000000000000001',role:'super_admin'};let failure;
 await require('../controllers/order.controller').updatePaymentStatus({params:{id:'650000000000000000000004'},body:{action:'mark_paid'},user:actor},{json(){},status(){return this;}},error=>{failure=error;});
 assert.equal(failure?.statusCode,409);assert.equal(writes,0);
 await assert.rejects(()=>require('../services/marketplaceRefund').execute('650000000000000000000004',10,actor),error=>error.statusCode===409);
 assert.equal(lookups,0);
});
