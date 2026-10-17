const test=require('node:test');
const assert=require('node:assert/strict');
const {freeStock,neededQty,productLines}=require('../services/salesReservations/quantities');
test('free stock excludes holds and expiry once, including existing quarantine',()=>{
 assert.equal(freeStock({onHand:10,reserved:8,expired:3,quarantinedExpired:3}),2);
 assert.equal(freeStock({onHand:10,reserved:5,expired:3,quarantinedExpired:0}),2);
 assert.equal(freeStock({onHand:-2,reserved:0,expired:0,quarantinedExpired:0}),0);
});
test('demand excludes gross delivery and owned holds, not returned goods or pack labels',()=>{
 assert.equal(neededQty({ordered:10,delivered:3,held:3,returned:2,packSize:12}),4);
 assert.equal(neededQty({ordered:2.5,delivered:1,held:.5}),1);
 assert.equal(neededQty({ordered:2,delivered:3,held:0}),0);
 for(const ordered of [NaN,Infinity,-1])assert.throws(()=>neededQty({ordered,delivered:0,held:0}),/quantity/i);
 assert.equal(productLines([{lineType:'note',quantity:100},{lineType:'section'},{quantity:2}]).length,1);
});
