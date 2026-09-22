// Read-only production verification. No service imports or database mutations.
require('dotenv').config({quiet:true});
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {MongoClient,ObjectId}=require('mongodb');
const client=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:2,serverSelectionTimeoutMS:12000});
async function main(){
  const dir=path.resolve(__dirname,'../../outputs/01a0c4d2-inventory-import');
  const imported=JSON.parse(fs.readFileSync(path.join(dir,'ckay-import-results.json'),'utf8'));
  const before=JSON.parse(fs.readFileSync(path.join(dir,'ckay-before.json'),'utf8'));
  assert.equal(imported.length,88);
  const tenant=new ObjectId('6aabec2b9294f4afed5ce61f');
  const warehouse=new ObjectId('6aac1540739aed42cba07329');
  await client.connect();
  const db=client.db();
  assert.equal(db.databaseName,'drinksharbour');
  const ids=imported.map(r=>new ObjectId(r.subProductId));
  const [subs,sizes,stocks,moves,products,oldSubs,count]=await Promise.all([
    db.collection('subproducts').find({tenant,_id:{$in:ids}}).toArray(),
    db.collection('sizes').find({tenant,subproduct:{$in:ids}}).toArray(),
    db.collection('warehousestocks').find({tenant,warehouse,subProduct:{$in:ids}}).toArray(),
    db.collection('inventorymovements').find({tenant,subProduct:{$in:ids},reference:'ckay-extracted-products-20260921'}).toArray(),
    db.collection('products').find({_id:{$in:imported.map(r=>new ObjectId(r.productId))}}).toArray(),
    db.collection('subproducts').find({tenant,_id:{$in:before.map(r=>new ObjectId(r._id))}},{projection:{_id:1,product:1,sku:1,status:1,costPrice:1,baseSellingPrice:1,totalStock:1}}).toArray(),
    db.collection('subproducts').countDocuments({tenant}),
  ]);
  assert.equal(subs.length,88);assert.equal(sizes.length,88);assert.equal(stocks.length,88);assert.equal(moves.length,88);
  for(const row of imported){
    const sp=subs.find(x=>String(x._id)===row.subProductId);
    const size=sizes.find(x=>String(x._id)===row.sizeId);
    const stock=stocks.find(x=>String(x.size)===row.sizeId);
    const movement=moves.find(x=>String(x.subProduct)===row.subProductId);
    const product=products.find(x=>String(x._id)===row.productId);
    for(const price of [sp.costPrice,sp.baseSellingPrice,size.costPrice,size.sellingPrice]) assert.equal(price,row.price,`${row.name}: price`);
    for(const qty of [sp.totalStock,size.stock,size.availableStock,stock.currentQuantity,movement.quantity]) assert.equal(qty,row.quantity,`${row.name}: stock`);
    assert.equal(sp.isPublished,true);assert.equal(sp.status,'active');
    if(row.name!=="Jack Daniel's Old No. 7") assert.equal(product.status,'pending');
  }
  for(const prior of before){
    const current=JSON.parse(JSON.stringify(oldSubs.find(x=>String(x._id)===prior._id)));
    assert.deepEqual(current,prior);
  }
  const result={verifiedAt:new Date().toISOString(),products:88,units:imported.reduce((n,r)=>n+r.quantity,0),tenantSubProducts:count,originalListingsUnchanged:before.length,pendingNewCentralProducts:products.filter(p=>p.status==='pending').length,linkedExistingProducts:1};
  fs.writeFileSync(path.join(dir,'ckay-final-verification.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e.name+': '+e.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1;}).finally(()=>client.close());
