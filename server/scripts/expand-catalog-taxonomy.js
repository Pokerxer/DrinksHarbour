// Preview by default. --apply requires --report PATH for rollback evidence.
require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose');
const fs=require('node:fs');
const Category=require('../models/Category');
const SubCategory=require('../models/SubCategory');
const {categories:definitions,subcategories,existingTargets}=require('../data/catalog-taxonomy-expansion');
const {reviewedProducts,findClassification}=require('../data/catalog-taxonomy-products');
async function run(){
 const apply=process.argv.includes('--apply');
 const reportIndex=process.argv.indexOf('--report');
 const reportPath=reportIndex>=0?process.argv[reportIndex+1]:null;
 if((apply||reportIndex>=0)&&!reportPath) throw new Error('--report PATH is required');
 if(!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db;
 const cats=db.collection('categories'),subs=db.collection('subcategories'),products=db.collection('products');
 const currentCats=await cats.find({}).toArray(), currentSubs=await subs.find({}).toArray();
 const newCats=[],newSubs=[],links=[],changes=[];
 const parents=new Map(),targets=new Map();
 const rootSlugs=[...new Set([...definitions.map(c=>c.slug),...subcategories.concat(existingTargets).map(s=>s.parent)])];
 for(const slug of rootSlugs){
  const definition=definitions.find(c=>c.slug===slug);
  const matches=currentCats.filter(c=>c.slug===slug||(definition&&c.name?.toLowerCase()===definition.name.toLowerCase()));
  if(matches.length>1||matches[0]?.parent||(matches[0]&&matches[0].slug!==slug))throw new Error('Duplicate/non-root category: '+slug);
  let target=matches[0];
  if(target&&target.status!=='published')throw new Error('Unpublished category: '+slug);
  if(!target){
   if(!definition)throw new Error('Missing existing category: '+slug);
   const doc=new Category({...definition,status:'published',parent:null,publishedAt:new Date(),
    description:`<p>${definition.shortDescription}</p>`,metaTitle:definition.name+' | DrinksHarbour'});
   await doc.validate();target=doc.toObject({virtuals:false});
   target.createdAt=target.updatedAt=new Date();newCats.push(target);
  }
  parents.set(slug,target);
 }
 for(const entry of subcategories.concat(existingTargets)){
  const parent=parents.get(entry.parent);
  const matches=currentSubs.filter(s=>s.slug===entry.slug||s.name?.toLowerCase()===entry.name?.toLowerCase());
  if(matches.length>1)throw new Error('Duplicate subcategory: '+entry.slug);
  let target=matches[0];
  if(target&&(String(target.parent)!==String(parent._id)||target.slug!==entry.slug||target.status!=='published'))
   throw new Error('Conflicting subcategory: '+entry.slug);
  if(!target){
   if(!entry.create)throw new Error('Missing existing subcategory: '+entry.slug);
   const doc=new SubCategory({name:entry.name,slug:entry.slug,parent:parent._id,parentPath:entry.parent,
    type:entry.slug,status:'published',shortDescription:entry.blurb,description:`<p>${entry.blurb}</p>`,
    metaTitle:entry.name+' | DrinksHarbour',publishedAt:new Date(),notes:'Whole catalog expansion 2026-10-15.'});
   await doc.validate();target=doc.toObject({virtuals:false});
   target.createdAt=target.updatedAt=new Date();newSubs.push(target);
  }
  targets.set(entry.slug,target);
  if(!(parent.subCategories||[]).some(id=>String(id)===String(target._id)))links.push({parent:parent._id,sub:target._id});
 }
 const catalog=await products.find({_id:{$in:reviewedProducts.map(p=>new mongoose.Types.ObjectId(p.id))}}).toArray();
 if(catalog.length!==reviewedProducts.length)throw new Error('Reviewed product is missing');
 for(const p of catalog){
  const classification=findClassification(p._id,p.name);
  const parent=parents.get(classification.parent),target=targets.get(classification.slug);
  if(!parent||!target)throw new Error('Missing classification target: '+p.name);
  if(String(p.category)!==String(parent._id)||String(p.subCategory)!==String(target._id)||p.type!==classification.type)
   changes.push({p,parent,target,type:classification.type});
 }
 const report=['# Whole catalog taxonomy audit','',`Date: ${new Date().toISOString()}`,'',
  `Reviewed: ${catalog.length}. New categories: ${newCats.length}. New subcategories: ${newSubs.length}. Product changes: ${changes.length}. Parent links: ${links.length}.`,'',
  '## Created taxonomy','', '| Collection | ID | Slug | Parent |','|---|---|---|---|',
  ...newCats.map(c=>`| categories | ${c._id} | ${c.slug} | root |`),
  ...newSubs.map(s=>`| subcategories | ${s._id} | ${s.slug} | ${s.parent} |`),'',
  '## Product changes and rollback values','',
  '| ID | Product | Previous category | Previous subcategory | Previous type | Target category | Target subcategory | Target type |',
  '|---|---|---|---|---|---|---|---|',
  ...changes.map(c=>`| ${c.p._id} | ${c.p.name} | ${c.p.category||'null'} | ${c.p.subCategory||'null'} | ${c.p.type} | ${c.parent._id} | ${c.target._id} | ${c.type} |`),'',
  '## New parent links','',...links.map(l=>`- ${l.parent} → ${l.sub}`),'',
  'Failure rolls back the transaction. Restore original references/types in a future migration before removing unused new taxonomy and links.',''].join('\n');
 if(reportPath)fs.writeFileSync(reportPath,report);
 console.log(report);
 if(!apply)return;
 if(!newCats.length&&!newSubs.length&&!links.length&&!changes.length){console.log('No further changes required.');return;}
 const session=await mongoose.startSession();
 try{await session.withTransaction(async()=>{
  if(newCats.length)await cats.insertMany(newCats,{session});
  if(newSubs.length)await subs.insertMany(newSubs,{session});
  for(const l of links){
   const result=await cats.updateOne({_id:l.parent},{$addToSet:{subCategories:l.sub}},{session});
   if(result.matchedCount!==1)throw new Error('Parent changed concurrently');
  }
  for(const c of changes){
   const result=await products.updateOne({_id:c.p._id,name:c.p.name,type:c.p.type,
    category:c.p.category||null,subCategory:c.p.subCategory||null},
    {$set:{category:c.parent._id,subCategory:c.target._id,type:c.type,updatedAt:new Date()}},{session});
   if(result.matchedCount!==1)throw new Error('Concurrent product change: '+c.p.name);
  }
  const catIds=new Map(newCats.map(c=>[String(c._id),c._id]));
  const subIds=new Map(newSubs.map(s=>[String(s._id),s._id]));
  for(const c of changes){
   for(const id of [c.p.category,c.parent._id])if(id)catIds.set(String(id),id);
   for(const id of [c.p.subCategory,c.target._id])if(id)subIds.set(String(id),id);
  }
  for(const [collection,field,ids]of [[cats,'category',catIds],[subs,'subCategory',subIds]])for(const id of ids.values()){
   const productCount=await products.countDocuments({[field]:id},{session});
   const activeProductCount=await products.countDocuments({[field]:id,status:'approved'},{session});
   await collection.updateOne({_id:id},{$set:{productCount,activeProductCount}},{session});
  }
 });console.log('Applied transaction successfully.');}finally{await session.endSession();}
}
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>mongoose.disconnect());
module.exports={run};
