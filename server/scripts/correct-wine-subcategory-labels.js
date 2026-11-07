// Display-label correction only; stable URLs/IDs are preserved. Preview by default.
const idOf=value=>String(value?._id||value);
function buildPlan(definitions, documents, parents) {
 const plan=[];
 for(const definition of definitions.filter(d=>d.name.startsWith('German '))){
  const source=documents.find(d=>d.slug===definition.slug);
  if(!source)throw Error('Missing source: '+definition.slug);
  const name=definition.name.slice(7);
  const matches=documents.filter(d=>idOf(d)!==idOf(source)&&d.name.toLowerCase()===name.toLowerCase()&&d.status==='published');
  if(matches.length>1||(matches[0]&&idOf(matches[0].parent)!==idOf(source.parent)))throw Error('Conflicting label: '+name);
  const target=matches[0];
  const changes={name:target?name+' (superseded)':name,metaTitle:name+' | DrinksHarbour'};
  if(target)changes.status='archived';
  else if(source.status!=='published')throw Error('Unpublished source: '+definition.slug);
  const parent=parents.find(p=>idOf(p)===idOf(source.parent));
  if(!parent)throw Error('Missing parent: '+source.slug);
  const staleLink=target&&(parent.subCategories||[]).some(id=>idOf(id)===idOf(source));
  const missingLink=target&&!(parent.subCategories||[]).some(id=>idOf(id)===idOf(target));
  if(Object.entries(changes).some(([key,value])=>source[key]!==value)||staleLink||missingLink)
   plan.push({kind:target?'reuse':'rename',source,target,changes});
 }
 return plan;
}
async function run(){
 require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
 const mongoose=require('mongoose'),fs=require('node:fs');
 const SubCategory=require('../models/SubCategory');
 const {subcategories}=require('../data/german-wine-subcategories');
 const apply=process.argv.includes('--apply'),arg=process.argv.indexOf('--report');
 const reportPath=arg>=0?process.argv[arg+1]:null;
 if(!reportPath)throw Error('--report PATH is required');
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 try{
  await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
  const db=mongoose.connection.db,subs=db.collection('subcategories'),cats=db.collection('categories');
  const plan=buildPlan(subcategories,await subs.find({}).toArray(),await cats.find({}).toArray());
  for(const action of plan)await new SubCategory({...action.source,...action.changes}).validate();
  fs.writeFileSync(reportPath,['# Wine label correction', '', 'Date: '+new Date().toISOString(),'',
   `Rename: ${plan.filter(a=>a.kind==='rename').length}. Reuse existing: ${plan.filter(a=>a.kind==='reuse').length}. Product writes: 0.`, '',
   ...plan.map(a=>`- ${a.source._id}: ${a.source.name} → ${a.changes.name}${a.target?' (reuse '+a.target._id+')':''}`),'',
   '## Before snapshots for rollback','', '```json',JSON.stringify(plan,null,2),'```','',
   'Rollback: restore the changed name/metaTitle/status fields and removed parent links from the snapshots. Do not overwrite whole records or alter product references. Slugs, IDs, product assignments and prices are preserved.',''].join('\n'));
  if(!apply){console.log(JSON.stringify({preview:true,actions:plan.length}));return;}
  const session=await mongoose.startSession();
  try{await session.withTransaction(async()=>{
   for(const action of plan){
    if(action.target){
     // MongoDB transactions require sequential operations on their session.
     const refs=[
      await db.collection('products').countDocuments({subCategory:action.source._id},{session}),
      await db.collection('flavors').countDocuments({subCategory:action.source._id},{session}),
      await subs.countDocuments({relatedSubCategories:action.source._id},{session}),
     ];
     if(refs.some(Boolean))throw Error('Referenced duplicate requires review: '+action.source.slug);
     const parent=await cats.updateOne({_id:action.source.parent},{$pull:{subCategories:action.source._id}},{session});
     if(parent.matchedCount!==1)throw Error('Parent changed concurrently');
     await cats.updateOne({_id:action.source.parent},{$addToSet:{subCategories:action.target._id}},{session});
    }
    const result=await subs.updateOne({_id:action.source._id,name:action.source.name,status:action.source.status},{$set:{...action.changes,updatedAt:new Date()}},{session});
    if(result.matchedCount!==1)throw Error('Subcategory changed concurrently');
   }
  });}finally{await session.endSession();}
  console.log(JSON.stringify({applied:plan.length,renamed:plan.filter(a=>a.kind==='rename').length,reused:plan.filter(a=>a.kind==='reuse').length,productWrites:0}));
 }finally{await mongoose.disconnect();}
}
module.exports={buildPlan,run};
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
