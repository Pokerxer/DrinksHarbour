// Independent read-only audit; verifies published taxonomy and exact counts.
require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose'),assert=require('node:assert/strict');
const {categories,subcategories}=require('../data/general-taxonomy-expansion');
async function run(){
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db;
 const cats=await db.collection('categories').find({}).toArray(),subs=await db.collection('subcategories').find({}).toArray();
 const targets=[];
 for(const definition of categories){
  const matches=cats.filter(c=>c.slug===definition.slug);assert.equal(matches.length,1,definition.slug);
  const doc=matches[0];assert.equal(doc.parent,null);assert.equal(doc.status,'published');
  assert.equal(doc.name,definition.name);assert.equal(doc.type,definition.type);
  assert.equal(doc.alcoholCategory,definition.alcoholCategory);targets.push(['categories','category',doc]);
 }
 for(const definition of subcategories){
  const matches=subs.filter(s=>s.slug===definition.slug);assert.equal(matches.length,1,definition.slug);
  const doc=matches[0],parent=cats.find(c=>c.slug===definition.parent);
  assert.equal(doc.status,'published');assert.equal(doc.name,definition.name);
  assert.equal(String(doc.parent),String(parent._id));
  assert.ok(parent.subCategories.some(id=>String(id)===String(doc._id)),definition.slug);
  targets.push(['subcategories','subCategory',doc]);
 }
 for(const collection of ['categories','subcategories']){
  const docs=targets.filter(t=>t[0]===collection).map(t=>t[2]);
  const field=collection==='categories'?'category':'subCategory';
  const counts=await db.collection('products').aggregate([
   {$match:{[field]:{$in:docs.map(d=>d._id)}}},
   {$group:{_id:'$'+field,productCount:{$sum:1},activeProductCount:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}}}},
  ]).toArray();
  for(const doc of docs){
   const count=counts.find(c=>String(c._id)===String(doc._id))||{productCount:0,activeProductCount:0};
   assert.equal(doc.productCount,count.productCount,doc.slug);
   assert.equal(doc.activeProductCount,count.activeProductCount,doc.slug);
  }
 }
 console.log(JSON.stringify({verifiedCategories:categories.length,verifiedSubcategories:subcategories.length,
  catalogTotals:{categories:cats.length,subcategories:subs.length},productWrites:0}));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
module.exports={run};
