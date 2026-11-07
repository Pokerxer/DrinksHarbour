'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
test('retail catalogue query excludes venue-only offers before pagination',()=>{
 const pipeline=require('../services/storefrontCatalog.service').catalogPipeline({_id:'a'.repeat(24)});
 assert.deepEqual(pipeline[0].$match.visibleInOnlineStore,{$ne:false});
});
