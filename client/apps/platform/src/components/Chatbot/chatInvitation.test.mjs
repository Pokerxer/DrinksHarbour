import test from 'node:test';
import assert from 'node:assert/strict';
import { INVITATION_KEY, scheduleInvitation, rememberInvitation } from './chatInvitation.ts';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('shows after five seconds and remembers the invitation across navigation', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const session = storage();
  let shown = 0;
  scheduleInvitation(session, () => shown++);
  t.mock.timers.tick(4999);
  assert.equal(shown, 0);
  t.mock.timers.tick(1);
  assert.equal(shown, 1);
  assert.equal(session.getItem(INVITATION_KEY), '1');
  scheduleInvitation(session, () => shown++);
  t.mock.timers.tick(5000);
  assert.equal(shown, 1);
});

test('cleanup cancels a pending invitation', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shown = false;
  const cancel = scheduleInvitation(storage(), () => { shown = true; });
  cancel();
  t.mock.timers.tick(5000);
  assert.equal(shown, false);
});

test('opening or dismissing chat suppresses future invitations', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const session = storage();
  rememberInvitation(session);
  let shown = false;
  scheduleInvitation(session, () => { shown = true; });
  t.mock.timers.tick(5000);
  assert.equal(shown, false);
});

test('blocked browser storage does not break the invitation', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  let shown = false;
  scheduleInvitation(blocked, () => { shown = true; });
  t.mock.timers.tick(5000);
  assert.equal(shown, true);
  assert.doesNotThrow(() => rememberInvitation(null));
});
