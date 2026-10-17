import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveRepresentativeVariant,pickDefaultVariant} from './default-variant.ts';
test('default price and IDs match the nearest representative rather than a cheaper farther seller',()=>{
  const product={shoppingOffer:{subProductId:'near',sizeId:'ns'},availableAt:[
    {_id:'far',tenant:{_id:'f'},sizes:[{_id:'fs',stock:1,pricing:{websitePrice:20}}]},
    {_id:'near',tenant:{_id:'n'},sizes:[{_id:'ns',stock:1,pricing:{websitePrice:100}}]},
  ]};
  assert.equal(resolveRepresentativeVariant(product).price,100);
  assert.equal(resolveRepresentativeVariant(product).subProductId,'near');
  assert.equal(pickDefaultVariant(product).price,100);
});

import {resolveCartLine} from './cart-line.ts';
test('quick add uses the same representative seller and size as the displayed price',()=>{
  const product={shoppingOffer:{subProductId:'sale',sizeId:'s'},availableAt:[
    {_id:'near',tenant:{_id:'n'},sizes:[{_id:'n1',size:'750ml',stock:1,pricing:{websitePrice:100}}]},
    {_id:'sale',tenant:{_id:'f'},sizes:[{_id:'s',size:'750ml',stock:1,pricing:{websitePrice:80}}]},
  ]};
  assert.equal(resolveCartLine(product).subProductId,'sale');
  assert.equal(resolveCartLine(product).sizeId,'s');
});
