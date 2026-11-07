'use strict';
// Administrative scripts must never silently select a live database.
function requireMongoUri(env = process.env) {
  const uri = env.MONGODB_URI || env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is required for this database operation');
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://');
  }
  return uri;
}
module.exports = { requireMongoUri };
