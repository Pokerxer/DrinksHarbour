const mongoose = require('mongoose');
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) throw new Error('Set MONGODB_URI or MONGO_URI before running the survey');
(async () => {
  await mongoose.connect(MONGO, { dbName: 'drinksharbour' });
  const db = mongoose.connection.db;
  const cat = db.collection('categories');
  const sub = db.collection('subcategories');
  const prod = db.collection('products');
  const [cats, subsCount, prodsCount] = await Promise.all([
    cat.find({}, {projection:{name:1,slug:1,type:1,status:1,parent:1,displayOrder:1}}).sort({displayOrder:1,name:1}).toArray(),
    sub.countDocuments(),
    prod.countDocuments()
  ]);
  console.log('TOTALS categories=%d subcategories=%d products=%d', cats.length, subsCount, prodsCount);
  const byType = {};
  for (const c of cats) byType[c.type] = (byType[c.type]||0)+1;
  console.log(JSON.stringify(byType));
  await mongoose.disconnect();
})().catch(e=>{console.error('ERR', e.message); process.exit(1);});
