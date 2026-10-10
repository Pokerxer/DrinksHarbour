'use strict';
// Isolated local fixture services only. This script never reads MONGODB_URI or a live Redis URL.
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { seed, tenantId } = require('./fixtures');
process.env.REDIS_URL = 'redis://127.0.0.1:27920';
process.env.REDIS_PUBLIC_METADATA_CACHE = 'true';
process.env.REDIS_NAMESPACE = 'drinks-redis-test';
const { runRedis, closeRedis } = require('../../config/redis');
const { RedisRateLimitStore } = require('../../middleware/redisRateLimitStore');
async function main() {
  mongoose.set('autoIndex', false);
  await mongoose.connect('mongodb://127.0.0.1:27919/drinks_redis_test', { autoIndex: false });
  try {
    await seed(mongoose.connection);
    await mongoose.connection.collection('products').updateMany({}, { $set: { updatedAt: new Date('2026-01-01') } });
    await require('../../config/performanceIndexes').ensurePerformanceIndexes(mongoose.connection);
    const a = new RedisRateLimitStore('verification'), b = new RedisRateLimitStore('verification');
    a.init({windowMs: 500}); b.init({windowMs: 500}); await a.resetKey('shared');
    const counters = await Promise.all(Array.from({length: 60}, (_, i) => (i % 2 ? a : b).increment('shared')));
    assert.deepEqual(counters.map(row => row.totalHits).sort((x,y) => x-y), Array.from({length:60},(_,i)=>i+1));
    await new Promise(resolve => setTimeout(resolve, 550));
    assert.equal((await b.increment('shared')).totalHits, 1);
    const catalog = require('../../services/storefrontCatalog.service');
    const tenant = {_id:tenantId(0)}, other = {_id:tenantId(1)};
    delete process.env.REDIS_URL;
    const baseline = await catalog.listProducts(tenant);
    process.env.REDIS_URL = 'redis://127.0.0.1:27920';
    assert.deepEqual(await catalog.listProducts(tenant), baseline);
    assert.deepEqual(await catalog.listProducts(tenant), baseline);
    assert.ok((await catalog.listProducts(other)).data.every(row=>row.sku.startsWith('T1-')));
    const offerId = baseline.data[0].id, productId = baseline.data[0].productId;
    const product = mongoose.connection.collection('products'), sizes = mongoose.connection.collection('sizes');
    await product.updateOne({_id:new mongoose.Types.ObjectId(productId)}, {$set:{description:'Updated public text',updatedAt:new Date('2026-01-02')}});
    await sizes.updateMany({subproduct:new mongoose.Types.ObjectId(offerId)},{$set:{sellingPrice:4321,availableStock:7}});
    const changed = await catalog.getProduct(tenant,offerId);
    assert.equal(changed.description,'Updated public text'); assert.equal(changed.sellingPrice,4321);
    assert.ok(changed.variants.every(row=>row.availableStock===7));
    await product.updateOne({_id:new mongoose.Types.ObjectId(productId)},{$set:{isPublished:false,updatedAt:new Date('2026-01-03')}});
    await assert.rejects(catalog.getProduct(tenant,offerId),/not found/i);
    await product.updateOne({_id:new mongoose.Types.ObjectId(productId)},{$set:{isPublished:true,description:'Synthetic catalogue description. '.repeat(30),updatedAt:new Date('2026-01-04')}});
    const index = Number(baseline.data[0].sku.split('-P')[1]);
    const variants = await sizes.find({subproduct:new mongoose.Types.ObjectId(offerId)}).toArray();
    for (const row of variants) await sizes.updateOne({_id:row._id},{$set:{sellingPrice:(1000+index)*(row.volumeMl===1500?2:1),availableStock:100}});
    const banners = mongoose.connection.collection('banners');
    const bannerId = new mongoose.Types.ObjectId();
    await banners.insertOne({_id:bannerId,tenant:tenant._id,title:'Scheduled',placement:'home_hero',status:'active',isActive:true,visibleTo:'all',
      isScheduled:true,startDate:new Date('2026-01-01'),endDate:new Date('2026-01-02'),updatedAt:new Date('2026-01-01'),image:{url:'https://example.invalid/banner.png'}});
    const service = require('../../services/storefrontBanners.service');
    assert.equal((await service.listBanners(tenant,{},new Date('2026-01-01T12:00:00Z')))[0].title,'Scheduled');
    assert.equal((await service.listBanners(tenant,{},new Date('2026-01-03'))).length,0);
    await banners.updateOne({_id:bannerId},{$set:{title:'Edited',updatedAt:new Date('2026-01-04')}});
    assert.equal((await service.listBanners(tenant,{},new Date('2026-01-01T12:00:00Z')))[0].title,'Edited');
    assert.equal((await service.listBanners(other,{},new Date('2026-01-01T12:00:00Z'))).length,0);
    await banners.deleteOne({_id:bannerId});
    const pong = await runRedis(client=>client.ping()); assert.equal(pong,'PONG');
    console.log('Verified real Redis: atomic shared counters, expiry, response equivalence, tenant isolation, fresh prices/stock, metadata edits, unpublish, banner schedules and edits.');
  } finally { await closeRedis(); await mongoose.disconnect(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
