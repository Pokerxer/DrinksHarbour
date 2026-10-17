import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatSellerDistance} from './seller-proximity.ts';
test('distance labels do not fabricate zero or a known distance for invalid data',()=>{
  assert.equal(formatSellerDistance(null),'Distance unavailable');
  assert.equal(formatSellerDistance(NaN),'Distance unavailable');
  assert.equal(formatSellerDistance(-1),'Distance unavailable');
  assert.equal(formatSellerDistance(.03),'Under 100 m away');
  assert.equal(formatSellerDistance(.35),'350 m away');
  assert.equal(formatSellerDistance(2.34),'≈2.3 km away');
});
