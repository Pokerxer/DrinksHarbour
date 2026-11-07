require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const mongoose=require('mongoose'),assert=require('node:assert/strict');
const {subcategories}=require('../data/german-wine-subcategories');
async function run(){
 if(process.env.NODE_DNS_SERVERS)require('dns').setServers(process.env.NODE_DNS_SERVERS.split(',').map(s=>s.trim()));
 try{
  await mongoose.connect(process.env.MONGODB_URI,{autoIndex:false,serverSelectionTimeoutMS:15000});
  const db=mongoose.connection.db,subs=await db.collection('subcategories').find({}).toArray(),cats=await db.collection('categories').find({}).toArray();
  let renamed=0,reused=0;
  for(const definition of subcategories){
   const source=subs.find(s=>s.slug===definition.slug);assert.ok(source,definition.slug);
   const expected=definition.name.replace(/^German /,'');
   const parent=cats.find(c=>c.slug===definition.parent);assert.ok(parent);
   let target=source;
   if(source.status==='archived'){
    target=subs.find(s=>s.name===expected&&s.status==='published'&&String(s.parent)===String(parent._id));
    assert.ok(target,expected);assert.ok(!parent.subCategories.some(id=>String(id)===String(source._id)));
    assert.equal(source.name,expected+' (superseded)');reused++;
   }else if(definition.name.startsWith('German '))renamed++;
   assert.equal(target.name,expected);assert.equal(target.status,'published');
   assert.equal(String(target.parent),String(parent._id));
   assert.ok(parent.subCategories.some(id=>String(id)===String(target._id)),expected);
  }
  assert.equal(subs.filter(s=>subcategories.some(d=>d.slug===s.slug)&&s.name.startsWith('German ')).length,0);
  console.log(JSON.stringify({verified:subcategories.length,renamed,reused,remainingGermanPrefixes:0,productWrites:0}));
 }finally{await mongoose.disconnect();}
}
if(require.main===module)run().catch(error=>{console.error(error.message);process.exitCode=1;});
