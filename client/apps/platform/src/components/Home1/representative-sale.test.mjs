import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBestSale} from './flash-sale-helpers.ts';
test('sale card uses the representative offer rather than a farther bigger discount',()=>{
  const p={shoppingOffer:{subProductId:'near',sizeId:'n'},availableAt:[
    {_id:'near',sizes:[{_id:'n',stock:1,pricing:{websitePrice:80},discount:{hasDiscount:true,savings:20,originalPrice:100}}]},
    {_id:'far',sizes:[{_id:'f',stock:1,pricing:{websitePrice:10},discount:{hasDiscount:true,savings:90,originalPrice:100}}]},
  ]};
  assert.equal(getBestSale(p).currentPrice,80);
});
