'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
test('money index migration replaces only the exact legacy per-bill uniqueness and preserves receipt keys', () => {
 const plan = require('../services/venue/money-indexes').planMoneyIndexes;
 const rows = [{name:'tenant_1_billOrder_1',key:{tenant:1,billOrder:1},unique:true},{name:'receipt_key',key:{tenant:1,receipt:1,billOrder:1,key:1},unique:true}];
 assert.deepEqual(plan(rows).legacyNames,['tenant_1_billOrder_1']);
 assert.deepEqual(plan([...rows.slice(1),{name:'v1',key:{tenant:1,billOrder:1},unique:true,partialFilterExpression:{collectionVersion:1}}]).legacyNames,[]);
});
