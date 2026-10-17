// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { requestIdentity, completeRequest } from './request-identity';
it('reuses lost-response identity, separates changed quantities and clears a completed payer',()=>{
  const scope='test-retry';
  const first=requestIdentity(scope,{qty:2});
  expect(requestIdentity(scope,{qty:2})).toBe(first);
  expect(requestIdentity(scope,{qty:3})).not.toBe(first);
  const next=requestIdentity(scope,{qty:2});completeRequest(scope);
  expect(requestIdentity(scope,{qty:2})).not.toBe(next);
  completeRequest(scope);
});
