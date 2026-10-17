import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveSellerChoice} from './representativeOffer.ts';
test('explicit SubProduct selection survives reordered offers and is not silently replaced when removed',()=>{
  const near={_id:'near',tenant:{_id:'same'}}, far={_id:'far',tenant:{_id:'same'}};
  assert.equal(resolveSellerChoice([near,far],'far','near'),far);
  assert.equal(resolveSellerChoice([far,near],'far','near'),far);
  assert.equal(resolveSellerChoice([near],'far','near'),null);
  assert.equal(resolveSellerChoice([near,far],null,'far'),far);
});
