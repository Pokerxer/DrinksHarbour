const test = require('node:test');
const assert = require('node:assert/strict');

const Tenant = require('../models/Tenant');
const ctrl = require('../controllers/pos.controller');

const oid = () => '507f1f77bcf86cd799439011';

function stubFindByIdAndUpdate(t, impl) {
  const original = Tenant.findByIdAndUpdate;
  Tenant.findByIdAndUpdate = impl;
  t.after(() => { Tenant.findByIdAndUpdate = original; });
}

function callUpdate(bankAccounts) {
  const req = { tenant: { _id: oid() }, body: { bankAccounts } };
  let status = 200;
  let payload;
  const res = {
    status(code) { status = code; return this; },
    json(body) { payload = body; return this; },
  };
  return ctrl
    .updateTenantBankAccounts(req, res, (e) => { throw e; })
    .then(() => ({ status, payload }));
}

test('updateTenantBankAccounts stores trimmed complete accounts', async (t) => {
  let stored;
  stubFindByIdAndUpdate(t, (_filter, update) => {
    stored = update.bankAccounts;
    return { then: (r) => r({ bankAccounts: update.bankAccounts }) };
  });

  const { status, payload } = await callUpdate([
    { bankName: '  GTBank  ', accountNumber: ' 0123456789 ', accountName: ' DrinksHarbour Ltd ' },
  ]);

  assert.strictEqual(status, 200);
  assert.deepStrictEqual(stored, [
    { bankName: 'GTBank', accountNumber: '0123456789', accountName: 'DrinksHarbour Ltd' },
  ]);
  assert.strictEqual(payload.success, true);
});

test('updateTenantBankAccounts refuses a half-filled account instead of storing it', async (t) => {
  // The whole point: this used to be stored, showed as saved in Settings, and
  // then never appeared on a printed invoice.
  let called = false;
  stubFindByIdAndUpdate(t, () => { called = true; return { then: (r) => r({ bankAccounts: [] }) }; });

  const { status, payload } = await callUpdate([{ bankName: '', accountNumber: '0123456789' }]);

  assert.strictEqual(status, 400);
  assert.match(payload.message, /both a bank name and an account number/);
  assert.strictEqual(called, false, 'must not write an account the invoice would drop');
});

test('updateTenantBankAccounts refuses a non-numeric account number', async (t) => {
  stubFindByIdAndUpdate(t, () => ({ then: (r) => r({ bankAccounts: [] }) }));
  const { status, payload } = await callUpdate([
    { bankName: 'GTBank', accountNumber: '0123-4567' },
  ]);
  assert.strictEqual(status, 400);
  assert.match(payload.message, /digits only/);
});

test('updateTenantBankAccounts refuses a duplicated account number', async (t) => {
  stubFindByIdAndUpdate(t, () => ({ then: (r) => r({ bankAccounts: [] }) }));
  const { status, payload } = await callUpdate([
    { bankName: 'GTBank', accountNumber: '0123456789' },
    { bankName: 'Zenith', accountNumber: '0123456789' },
  ]);
  assert.strictEqual(status, 400);
  assert.match(payload.message, /more than once/);
});

test('updateTenantBankAccounts still allows clearing every account', async (t) => {
  let stored;
  stubFindByIdAndUpdate(t, (_filter, update) => {
    stored = update.bankAccounts;
    return { then: (r) => r({ bankAccounts: update.bankAccounts }) };
  });
  const { status } = await callUpdate([]);
  assert.strictEqual(status, 200);
  assert.deepStrictEqual(stored, []);
});

test('updateTenantBankAccounts does not accept a JSON-string body', async (t) => {
  // Unlike the admin tenant form, this endpoint takes a real array. The admin
  // client always sends one; accepting a string here would only paper over a
  // caller bug, so it stays a 400.
  let called = false;
  stubFindByIdAndUpdate(t, () => { called = true; return { then: (r) => r({ bankAccounts: [] }) }; });
  const { status, payload } = await callUpdate(
    JSON.stringify([{ bankName: 'GTBank', accountNumber: '0123456789' }])
  );
  assert.strictEqual(status, 400);
  assert.match(payload.message, /must be an array/);
  assert.strictEqual(called, false);
});

test('updateTenantBankAccounts rejects a non-array body', async () => {
  const req = { tenant: { _id: oid() }, body: { bankAccounts: 'nope' } };
  let status = 200;
  let payload;
  const res = { status(c) { status = c; return this; }, json(b) { payload = b; return this; } };
  await ctrl.updateTenantBankAccounts(req, res, (e) => { throw e; });
  assert.strictEqual(status, 400);
  assert.match(payload.message, /must be an array/);
});
