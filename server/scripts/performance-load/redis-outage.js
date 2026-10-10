'use strict';
const assert = require('node:assert/strict');
const express = require('express');
const rateLimit = require('express-rate-limit');
process.env.REDIS_URL = 'redis://127.0.0.1:27921'; // Intentionally absent isolated local service.
process.env.REDIS_NAMESPACE = 'drinks-redis-outage-test';
const { sharedStore } = require('../../middleware/redisRateLimitStore');
const { createMetadataCache } = require('../../services/publicMetadataCache');
const { closeRedis } = require('../../config/redis');
async function main() {
  const app = express();
  app.use(rateLimit({ ...sharedStore('outage'), windowMs: 60000, limit: 2 }));
  app.get('/', (_,res)=>res.send('unexpected success'));
  app.use((error,_,res,_next)=>res.status(error.statusCode||500).json({success:false}));
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {
    const start=Date.now();
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}`)).status,503);
    assert.ok(Date.now()-start<2000,'Outage must be bounded');
    const rows=[{_id:'public-product',updatedAt:new Date('2026-01-01')}];
    assert.equal((await createMetadataCache().read('tenant','product',rows,async refs=>refs.map(row=>({...row,description:'database fallback'}))))[0].description,'database fallback');
    console.log('Verified actual connection outage: shared HTTP limiter returns 503; metadata falls back within the connection deadline.');
  }finally{
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await closeRedis();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
