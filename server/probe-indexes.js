require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  for (const col of ['subproducts', 'sizes', 'tenants']) {
    const ix = await db.collection(col).indexes();
    console.log(col, 'indexes:', ix.map(i => i.name).join(' | '));
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
