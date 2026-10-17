import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveShoppingLocation, changeShoppingAccount, readShoppingSession} from './shopping-location.ts';
test('delivery wins over current location; account-derived addresses clear on account changes',()=>{
  const delivery={lat:0,lon:0,label:'Delivery',source:'delivery',ownerId:'a'};
  const current={lat:1,lon:1,label:'Current location',source:'current'};
  const state={accountId:'a',explicit:null,defaultDelivery:delivery,current};
  assert.equal(resolveShoppingLocation(state),delivery);
  assert.equal(resolveShoppingLocation(changeShoppingAccount(state,'b')),current);
  assert.equal(readShoppingSession('bad'),null);
  assert.equal(readShoppingSession('{"lat":91,"lon":0,"source":"delivery","label":"bad"}'),null);
});

test('an explicitly confirmed current location takes priority over a saved default',()=>{
  const delivery={lat:1,lon:1,label:'Default address',source:'delivery',ownerId:'a'};
  const current={lat:0,lon:0,label:'Current location',source:'current',ownerId:'a'};
  assert.equal(resolveShoppingLocation({accountId:'a',explicit:current,defaultDelivery:delivery,current:null}),current);
});
