// Additive taxonomy only. Preview by default; --apply requires --report PATH.
require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose');
const fs=require('node:fs');
const Category=require('../models/Category');
const SubCategory=require('../models/SubCategory');
const {categories:definitions,subcategories}=require('../data/whisky-subcategories');
async function run(){
 const apply=process.argv.includes('--apply'),index=process.argv.indexOf('--report');
 const reportPath=index>=0?process.argv[index+1]:null;
 if((apply||index>=0)&&!reportPath)throw new Error('--report PATH is required');
 if(!process.env.MONGODB_URI)throw new Error('MONGODB_URI is required');
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db,cats=db.collection('categories'),subs=db.collection('subcategories');
 const currentCats=await cats.find({}).toArray(),currentSubs=await subs.find({}).toArray();
 const newCats=[],newSubs=[],links=[],parents=new Map();
 for(const slug of new Set([...definitions.map(d=>d.slug),...subcategories.map(s=>s.parent)])){
  const definition=definitions.find(d=>d.slug===slug);
  const matches=currentCats.filter(c=>c.slug===slug||(definition&&c.name.toLowerCase()===definition.name.toLowerCase()));
  if(matches.length>1||matches[0]?.parent||(matches[0]&&matches[0].slug!==slug))throw new Error('Conflicting category: '+slug);
  let target=matches[0];
  if(target&&target.status!=='published')throw new Error('Unpublished category: '+slug);
  if(!target){
   if(!definition)throw new Error('Missing existing parent: '+slug);
   const doc=new Category({...definition,parent:null,status:'published',publishedAt:new Date(),
    description:`<p>${definition.shortDescription}</p>`,metaTitle:definition.name+' | DrinksHarbour'});
   await doc.validate();target=doc.toObject({virtuals:false});target.createdAt=target.updatedAt=new Date();newCats.push(target);
  }
  parents.set(slug,target);
 }
 for(const entry of subcategories){
  const parent=parents.get(entry.parent);
  const matches=currentSubs.filter(s=>s.slug===entry.slug||s.name.toLowerCase()===entry.name.toLowerCase());
  if(matches.length>1)throw new Error('Duplicate subcategory: '+entry.slug);
  let target=matches[0];
  if(target&&(target.slug!==entry.slug||String(target.parent)!==String(parent._id)||target.status!=='published'))
   throw new Error('Conflicting subcategory: '+entry.slug);
  if(!target){
   const doc=new SubCategory({name:entry.name,slug:entry.slug,parent:parent._id,parentPath:entry.parent,
    type:entry.slug,status:'published',shortDescription:entry.blurb,description:`<p>${entry.blurb}</p>`,
    metaTitle:entry.name+' | DrinksHarbour',publishedAt:new Date(),notes:'Whisky subcategory expansion 2026-10-15.'});
   await doc.validate();target=doc.toObject({virtuals:false});target.createdAt=target.updatedAt=new Date();newSubs.push(target);
  }
  if(!(parent.subCategories||[]).some(id=>String(id)===String(target._id)))links.push({parent:parent._id,sub:target._id});
 }
 const report=['# Whisky subcategory audit','',`Date: ${new Date().toISOString()}`,'',
  `New categories: ${newCats.length}. New subcategories: ${newSubs.length}. Parent links: ${links.length}. Product changes: 0.`,'',
  '## New taxonomy','', '| Collection | ID | Name | Slug | Parent |','|---|---|---|---|---|',
  ...newCats.map(c=>`| categories | ${c._id} | ${c.name} | ${c.slug} | root |`),
  ...newSubs.map(s=>`| subcategories | ${s._id} | ${s.name} | ${s.slug} | ${s.parent} |`),'',
  '## Added parent links','',...links.map(l=>`- ${l.parent} → ${l.sub}`),'',
  'Transaction failure rolls back all writes. Later rollback must remove added links and new taxonomy only after checking for Product references. Existing Products and tenant records are never written by this script.',''].join('\n');
 if(reportPath)fs.writeFileSync(reportPath,report);console.log(report);
 if(!apply)return;
 if(!newCats.length&&!newSubs.length&&!links.length){console.log('No further changes required.');return;}
 const session=await mongoose.startSession();
 try{await session.withTransaction(async()=>{
  if(newCats.length)await cats.insertMany(newCats,{session});
  if(newSubs.length)await subs.insertMany(newSubs,{session});
  const byParent=new Map();
  for(const link of links){
   const key=String(link.parent);
   if(!byParent.has(key))byParent.set(key,{parent:link.parent,subs:[]});
   byParent.get(key).subs.push(link.sub);
  }
  if(byParent.size){
   const result=await cats.bulkWrite([...byParent.values()].map(link=>({updateOne:{
    filter:{_id:link.parent,status:'published'},update:{$addToSet:{subCategories:{$each:link.subs}}},
   }})),{session});
   if(result.matchedCount!==byParent.size)throw new Error('Parent changed concurrently');
  }
  for(const [collection,field,docs]of [[cats,'category',newCats],[subs,'subCategory',newSubs]]){
   const counts=await db.collection('products').aggregate([
    {$match:{[field]:{$in:docs.map(d=>d._id)}}},
    {$group:{_id:'$'+field,productCount:{$sum:1},activeProductCount:{$sum:{$cond:[{$eq:['$status','approved']},1,0]}}}},
   ],{session}).toArray();
   if(docs.length)await collection.bulkWrite(docs.map(doc=>{
    const count=counts.find(c=>String(c._id)===String(doc._id))||{productCount:0,activeProductCount:0};
    return {updateOne:{filter:{_id:doc._id},update:{$set:{productCount:count.productCount,activeProductCount:count.activeProductCount}}}};
   }),{session});
  }
 });console.log('Applied transaction successfully.');}finally{await session.endSession();}
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
module.exports={run};
