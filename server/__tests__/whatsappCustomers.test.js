'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../models/User');
const { listCustomers, saveCustomer } = require('../services/whatsappCustomers');

test('searches active platform customers by Nigerian phone across formats', async t => {
  t.mock.method(User, 'find', (filter) => {
    assert.equal(filter.role, 'customer');
    assert.equal(filter.tenant, null);
    const phone = filter.$or.find(branch => branch.phone).phone;
    assert.ok(phone.test('+234 801 234 5678'));
    assert.ok(phone.test('08012345678'));
    const query = { sort: () => query, limit: () => query, select: () => query,
      lean: async () => [{ _id: 'customer', firstName: 'Ada', loyaltyPoints: 42, passwordHash: 'private' }] };
    return query;
  });
  const [customer] = await listCustomers('08012345678');
  assert.equal(customer.loyaltyPoints, 42);
  assert.equal(customer.passwordHash, undefined);
});

test('saving the same marketplace email returns the existing customer', async t => {
  t.mock.method(User, 'findOne', ({ $or }) => {
    assert.equal($or[0].email, 'ada@example.com');
    const query = { select: () => query, lean: async () => ({
      _id: 'customer', email: 'ada@example.com', loyaltyPoints: 42, firstName: 'Ada',
    }) };
    return query;
  });
  const create = t.mock.method(User, 'create', async () => { throw new Error('Unexpected duplicate'); });
  const customer = await saveCustomer({ firstName: 'Ada', lastName: 'Obi', email: 'ADA@example.com', phone: '08012345678' });
  assert.equal(customer._id, 'customer');
  assert.equal(customer.loyaltyPoints, 42);
  assert.equal(create.mock.callCount(), 0);
});

test('customer context refreshes loyalty and looks up addresses only for the selected platform buyer', async t => {
  const id = '507f1f77bcf86cd799439011';
  const Address = require('../models/Address');
  const Order = require('../models/Order');
  t.mock.method(User, 'findOne', filter => {
    assert.equal(filter._id, id);
    assert.equal(filter.tenant, null);
    assert.equal(filter.role, 'customer');
    return { select: () => ({ lean: async () => ({ _id: id, loyaltyPoints: 84, loyaltyTier: 'barrel' }) }) };
  });
  t.mock.method(Address, 'find', filter => {
    assert.equal(filter.user, id);
    assert.equal(filter.status, 'active');
    const q = { sort: () => q, limit: () => q, select: () => q, lean: async () => [{
      _id: 'address', label: 'Home', city: 'Ikeja', state: 'Lagos State', country: 'Nigeria',
      addressLine1: '1 Example Street', coordinates: { lat: 6.6, lng: 3.4 }, phone: 'private',
    }] };
    return q;
  });
  t.mock.method(Order, 'findOne', query => {
    assert.equal(query.user, id);
    assert.equal(query.tenant, null);
    assert.equal(query.status, 'delivered');
    assert.deepEqual(query['gift.isGift'], { $ne: true });
    const q = { sort: () => q, select: () => q, lean: async () => null };
    return q;
  });
  const { getCustomerContext } = require('../services/whatsappCustomers');
  const result = await getCustomerContext(id);
  assert.equal(result.customer.loyaltyPoints, 84);
  assert.deepEqual(result.addresses, [{
    id: 'address', label: 'Home', address: '1 Example Street', lga: 'Ikeja',
    state: 'Lagos', zipCode: '', country: 'Nigeria', pin: { lat: 6.6, lon: 3.4 },
  }]);
});
