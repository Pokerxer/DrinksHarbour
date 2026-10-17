import {test} from 'node:test';
import assert from 'node:assert/strict';
import {purchaseLimits, clampPurchaseQuantity} from './purchase-quantity.ts';
test('stock caps an explicit maximum and quantity changes clamp to the new size',()=>{
 const limits=purchaseLimits({stock:4,minOrderQuantity:1,maxOrderQuantity:20});
 assert.equal(limits.max,4);assert.equal(limits.canBuy,true);
 assert.equal(clampPurchaseQuantity(6,limits),4);
});
test('insufficient stock for the minimum cannot be purchased or raised to the minimum',()=>{
 const limits=purchaseLimits({stock:2,minOrderQuantity:6,maxOrderQuantity:20});
 assert.equal(limits.canBuy,false);assert.equal(clampPurchaseQuantity(6,limits),0);
});
test('unknown, sold-out and zero-stock variants never get the old 99-unit fallback',()=>{
 for(const size of [null,{stock:0},{stock:NaN},{stock:5,availability:'out_of_stock'},{stock:5,availableStock:0},{stock:5,inStock:false},{stock:5,maxOrderQuantity:0}]){
  const limits=purchaseLimits(size);assert.equal(limits.canBuy,false);
  assert.equal(clampPurchaseQuantity(1,limits),0);
 }
});
test('seller order caps below the minimum are unavailable',()=>{
 assert.equal(purchaseLimits({stock:20,minOrderQuantity:6,maxOrderQuantity:3}).canBuy,false);
});
