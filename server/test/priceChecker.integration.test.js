// Isolated replica set only. Never reads application environment/database URLs.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-price-checker-integration-only';
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Stock = require('../models/WarehouseStock');
const Product = require('../models/Product');
const Size = require('../models/Size');
const SubProduct = require('../models/SubProduct');
const Pricelist = require('../models/Pricelist');
require('../models/Brand');
const Kiosk = require('../models/PriceCheckerKiosk');
const Scan = require('../models/KioskScan');
const Unknown = require('../models/UnknownBarcodeScan');
const { saveKiosk, options } = require('../services/priceChecker/configuration');
const { loadContext } = require('../services/priceChecker/context');
const { lookup } = require('../services/priceChecker/lookup');
const { logScan } = require('../services/priceChecker/scans');
const { getAnalytics } = require('../services/priceChecker/analytics');
const router = require('../routes/priceChecker.routes');
const oid = () => new mongoose.Types.ObjectId();
const ids = {tenant:oid(),other:oid(),location:oid(),otherLocation:oid(),product:oid(),sub:oid(),size:oid(),otherSize:oid(),list:oid(),user:oid()};
let kiosk, context, server, base;
const uri = process.env.KIOSK_TEST_MONGO_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27187\/price_checker_test(?:\?|$)/.test(uri)) throw new Error('Set KIOSK_TEST_MONGO_URI to the isolated localhost:27187/price_checker_test replica set.');
test.before(async()=>{
 await mongoose.connect(uri);
 await mongoose.connection.dropDatabase();
 await Promise.all([Kiosk.init(),Scan.init(),Unknown.init()]);
 await Tenant.collection.insertMany([
  {_id:ids.tenant,name:'Test shop',slug:'price-test',status:'approved',subscriptionStatus:'active',plan:'starter',posSettings:{retailWarehouse:ids.location}},
  {_id:ids.other,name:'Other tenant',slug:'other-test',status:'approved',subscriptionStatus:'active',plan:'starter',posSettings:{retailWarehouse:ids.otherLocation}},
 ]);
 await Warehouse.collection.insertMany([{_id:ids.location,tenant:ids.tenant,name:'Branch A',isActive:true,isDefault:true},{_id:ids.otherLocation,tenant:ids.other,name:'Other branch',isActive:true}]);
 await User.collection.insertOne({_id:ids.user,tenant:ids.tenant,role:'tenant_admin',status:'active',email:'kiosk-test@example.invalid'});
 await Product.collection.insertOne({_id:ids.product,name:'Test bottle',status:'approved',isPublished:true,isAlcoholic:false});
 await SubProduct.collection.insertOne({_id:ids.sub,tenant:ids.tenant,product:ids.product,isPublished:true,status:'active',baseSellingPrice:1000,currency:'NGN'});
 await Size.collection.insertMany([
  {_id:ids.size,tenant:ids.tenant,subproduct:ids.sub,barcode:'00123',size:'70cl',sellingPrice:2000,currency:'NGN',status:'active'},
  {_id:ids.otherSize,tenant:ids.other,subproduct:oid(),barcode:'00123',size:'1L',sellingPrice:1,currency:'NGN',status:'active'},
 ]);
 await Stock.collection.insertMany([
  {tenant:ids.tenant,warehouse:ids.location,subProduct:ids.sub,size:ids.size,currentQuantity:10,reservedQuantity:2,minStockLevel:3},
  {tenant:ids.other,warehouse:ids.otherLocation,subProduct:ids.sub,size:ids.size,currentQuantity:999,reservedQuantity:0,minStockLevel:1},
 ]);
 await Pricelist.collection.insertOne({_id:ids.list,tenant:ids.tenant,name:'Retail',currency:'NGN',isDefault:true,shops:[],warehouses:[],customerTags:[],rules:[{priceType:'discount',discountPercentage:10,sequence:1}]});
 kiosk=await saveKiosk(ids.tenant,{name:'Test kiosk',internalId:'TEST_01',slug:'test-counter',shopId:'retail',location:String(ids.location)});
 context=await loadContext(kiosk);
 const app=express();app.use(express.json());app.use('/api/price-checker',router);
 app.use((error,req,res,next)=>res.status(error.statusCode||500).json({success:false,message:error.message}));
 server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
 base=`http://127.0.0.1:${server.address().port}/api/price-checker`;
});
test.after(async()=>{await new Promise(resolve=>server?server.close(resolve):resolve());await mongoose.connection.dropDatabase();await mongoose.disconnect();});
test('exact variant and branch return the live one-unit pricelist price',async()=>{
 const result=await lookup(context,'00123');assert.equal(result.product.price,1800);assert.equal(result.product.size,'70cl');assert.equal(result.record.availableQuantity,8);
 const choices=await options(ids.tenant);assert.equal(choices.pricelists.length,1);assert.equal(choices.locations.length,1);
});
test('cross-tenant kiosk assignments and management reads are refused',async()=>{
 await assert.rejects(saveKiosk(ids.other,{name:'Wrong',internalId:'WRONG',slug:'wrong',shopId:'retail',location:String(ids.location)}));
 const token=jwt.sign({userId:String(ids.user)},process.env.JWT_SECRET);
 const res=await fetch(base+'/kiosks',{headers:{Authorization:`Bearer ${token}`}});assert.equal(res.status,200);
 const body=await res.json();assert.equal(body.data.length,1);assert.equal(String(body.data[0].tenant),String(ids.tenant));
});
test('public HTTP flow logs scans without exposing private identifiers',async()=>{
 const open=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:kiosk.slug})});assert.equal(open.status,200);
 const {token}=await open.json();
 const res=await fetch(base+'/scan',{method:'POST',headers:{'Content-Type':'application/json','X-Price-Checker-Session':token},body:JSON.stringify({barcode:'00123',requestId:'request-http-00001'})});
 assert.equal(res.status,200);const body=await res.json();assert.equal(body.data.product.price,1800);
 for(const key of ['tenant','subProduct','sizeId','costPrice','availableQuantity','quantity'])assert.equal(body.data.product[key],undefined);
 assert.equal(await Scan.countDocuments({tenant:ids.tenant,barcode:'00123'}),1);
});
test('concurrent unknown scans count every event exactly once including retry overlap',async()=>{
 const jobs=Array.from({length:15},(_,i)=>logScan(context,'00999',`unknown-request-${String(i).padStart(6,'0')}`,{outcome:'UNKNOWN'}));
 await Promise.all(jobs);
 await Promise.all(Array.from({length:4},()=>logScan(context,'00999','unknown-request-000000',{outcome:'UNKNOWN'})));
 assert.equal(await Scan.countDocuments({tenant:ids.tenant,barcode:'00999'}),15);
 const row=await Unknown.findOne({tenant:ids.tenant,barcode:'00999'}).lean();assert.equal(row.count,15);
});
test('analytics excludes foreign scans and resolves current price and low stock',async()=>{
 await Scan.collection.insertOne({tenant:ids.other,kiosk:oid(),location:ids.otherLocation,barcode:'00123',requestId:'foreign-request-001',found:true,outcome:'FOUND',scannedAt:new Date()});
 await Stock.updateOne({tenant:ids.tenant,warehouse:ids.location,size:ids.size},{$set:{currentQuantity:3,reservedQuantity:1}});
 const report=await getAnalytics(String(ids.tenant),{});
 assert.equal(report.overview.total,16);assert.equal(report.overview.unknown,15);assert.equal(report.overview.successful,1);
 assert.equal(report.popular[0].currentPrice,1800);assert.equal(report.lowStock[0].quantity,2);assert.equal(report.unknown[0].count,15);
});
test('disabled kiosks stop both session creation and existing sessions',async()=>{
 const res=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:kiosk.slug})});const {token}=await res.json();
 await saveKiosk(ids.tenant,{enabled:false},String(kiosk._id));
 const old=await fetch(base+'/config',{headers:{'X-Price-Checker-Session':token}});assert.equal(old.status,401);
 const renewed=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:kiosk.slug})});assert.equal(renewed.status,404);
});
