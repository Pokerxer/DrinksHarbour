const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePreferences, TEMPLATE_IDS } = require('../config/document-templates');

test('all eight approved styles can be saved with family overrides', () => {
  assert.equal(TEMPLATE_IDS.length, 8);
  for (const id of TEMPLATE_IDS) {
    assert.deepEqual(validatePreferences({ defaultTemplate: id, families: { stock: 'ledger' } }),
      { version: 1, defaultTemplate: id, families: { stock: 'ledger' } });
  }
});
test('rejects arbitrary templates, families, versions and tenant selectors', () => {
  for (const body of [null, [], {}, { defaultTemplate: 'html' },
    { defaultTemplate: 'modern', tenantId: 'someone-else' },
    { defaultTemplate: 'modern', version: 2 },
    { defaultTemplate: 'modern', families: { other: 'classic' } },
    { defaultTemplate: 'modern', families: { sales: '<script>' } }]) {
    assert.throws(() => validatePreferences(body));
  }
});
const Tenant = require('../models/Tenant');
const controller = require('../controllers/documentTemplate.controller');
const response = () => ({ set() {}, json(value) { this.value = value; } });
test('reads JWT tenant even when a different tenant selector is supplied', async t => {
  t.mock.method(Tenant, 'findOne', query => {
    assert.deepEqual(query, { _id: 'own' });
    return { select: () => ({ lean: async () => ({}) }) };
  });
  const res = response();
  await controller.read({ user: { tenant: 'own' }, tenant: { _id: 'other' }, query: { tenant: 'other' } }, res);
  assert.equal(res.value.data.defaultTemplate, 'classic');
});
test('saves only authenticated tenant preferences with mongoose validation', async t => {
  t.mock.method(Tenant, 'updateOne', async (query, update, options) => {
    assert.deepEqual(query, { _id: 'own' });
    assert.equal(update.$set.documentTemplates.defaultTemplate, 'axis');
    assert.equal(options.runValidators, true);
    return { matchedCount: 1 };
  });
  await controller.update({ user: { tenant: 'own' }, tenant: { _id: 'other' }, body: { defaultTemplate: 'axis' } }, response());
});
test('rejects missing tenant context and missing tenant records', async t => {
  await assert.rejects(controller.read({ user: { role: 'tenant_staff' } }, response()), /Tenant context required/);
  t.mock.method(Tenant, 'findOne', () => ({ select: () => ({ lean: async () => null }) }));
  await assert.rejects(controller.read({ user: { tenant: 'own' } }, response()), /Tenant not found/);
});
test('settings write guard rejects staff without a settings grant', async () => {
  const { authorizeTenantAction } = require('../middleware/auth.middleware');
  const guard = authorizeTenantAction('settings:write');
  let allowed = false;
  assert.throws(() => guard({ user: { role: 'tenant_staff', tenant: 'own' }, tenant: { _id: 'own' } }, response(), () => { allowed = true; }));
  assert.equal(allowed, false);
  guard({ user: { role: 'tenant_staff', tenant: 'own', customPermissions: ['settings:write'] }, tenant: { _id: 'own' } }, response(), () => { allowed = true; });
  assert.equal(allowed, true);
});
