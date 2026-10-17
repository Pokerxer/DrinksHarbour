import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shoppingHeaders,createShoppingRequestGate} from './shoppingRequest.ts';
test('coordinates travel in private header and preserve authorization; old completions are rejected',()=>{
  const headers=shoppingHeaders({lat:0,lon:0},{Authorization:'Bearer test'});
  assert.equal(headers.get('x-shopping-location'),'{"lat":0,"lon":0}');
  assert.equal(headers.get('Authorization'),'Bearer test');
  const gate=createShoppingRequestGate(), old=gate.begin(),current=gate.begin();
  assert.equal(gate.isCurrent(old),false);
  assert.equal(gate.isCurrent(current),true);
  gate.cancel();
  assert.equal(gate.isCurrent(current),false);
});
