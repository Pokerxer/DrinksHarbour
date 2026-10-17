// Independent read-only verification of the catalog expansion; no mutations.
require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {categories,subcategories,existingTargets}=require('../data/catalog-taxonomy-expansion');
const {reviewedProducts}=require('../data/catalog-taxonomy-products');
async function run(){
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db;
 const parents=await db.collection('categories').find({}).toArray();
 const subs=await db.collection('subcategories').find({}).toArray();
 const catalog=await db.collection('products').find({_id:{$in:reviewedProducts.map(p=>new mongoose.Types.ObjectId(p.id))}}).toArray();
 const catIds=new Map(),subIds=new Map();
 for(const c of categories){
  const matches=parents.filter(p=>p.slug===c.slug);assert.equal(matches.length,1,c.slug);
  assert.equal(matches[0].status,'published');catIds.set(String(matches[0]._id),matches[0]._id);
 }
 for(const s of subcategories.concat(existingTargets)){
  const matches=subs.filter(p=>p.slug===s.slug);assert.equal(matches.length,1,s.slug);
  const sub=matches[0],parent=parents.find(p=>p.slug===s.parent);
  assert.equal(sub.status,'published');assert.equal(String(sub.parent),String(parent._id));
  assert.ok(parent.subCategories.some(id=>String(id)===String(sub._id)),s.slug);
  subIds.set(String(sub._id),sub._id);catIds.set(String(parent._id),parent._id);
 }
 assert.equal(catalog.length,reviewedProducts.length);
 const groups={};
 for(const r of reviewedProducts){
  const p=catalog.find(p=>String(p._id)===r.id);
  assert.equal(p.name,r.name);assert.equal(p.type,r.type);
  assert.equal(String(p.category),String(parents.find(c=>c.slug===r.parent)._id));
  assert.equal(String(p.subCategory),String(subs.find(s=>s.slug===r.slug)._id));
  groups[r.parent]=(groups[r.parent]||0)+1;
 }
 // Include old category/subcategory IDs recorded by the transaction's before report.
 const reportIndex=process.argv.indexOf('--before');
 if(reportIndex>=0){
  const report=fs.readFileSync(process.argv[reportIndex+1],'utf8');
  for(const line of report.split('\n')){
   const cells=line.split('|').map(s=>s.trim());
   if(cells.length===10&&/^[a-f0-9]{24}$/.test(cells[1])){
    if(/^[a-f0-9]{24}$/.test(cells[3]))catIds.set(cells[3],new mongoose.Types.ObjectId(cells[3]));
    if(/^[a-f0-9]{24}$/.test(cells[4]))subIds.set(cells[4],new mongoose.Types.ObjectId(cells[4]));
   }
  }
 }
 for(const [collection,field,ids]of [['categories','category',catIds],['subcategories','subCategory',subIds]]){
  const counts=await db.collection('products').aggregate([
   {$match:{[field]:{$in:[...ids.values()]}}},
   {$group:{_id:'$'+field,productCount:{$sum:1},activeProductCount:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}}}},
  ]).toArray();
  for(const id of ids.values()){
   const doc=(collection==='categories'?parents:subs).find(d=>String(d._id)===String(id));
   const count=counts.find(c=>String(c._id)===String(id))||{productCount:0,activeProductCount:0};
   assert.equal(doc.productCount,count.productCount,doc.slug+' total count');
   assert.equal(doc.activeProductCount,count.activeProductCount,doc.slug+' active count');
  }
 }
 console.log(JSON.stringify({verifiedProducts:catalog.length,categories:categories.length,subcategories:subcategories.length,groups}));
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
module.exports={run};
