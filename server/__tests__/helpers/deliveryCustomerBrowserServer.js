'use strict';
// Local-only test server. No application startup, dotenv, live provider or messages.
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const { connectVenueMongo } = require('./venueMongo');
async function main() {
  Object.assign(process.env, {
    JWT_SECRET: 'delivery-customer-synthetic-jwt-only',
    MERCHANT_FULFILLMENT_ENABLED: 'true',
    MERCHANT_QUANTITY_FULFILLMENT_ENABLED: 'true',
    MERCHANT_LOCAL_DISPATCH_ENABLED: 'false',
  });
  const cleanup = [];
  await connectVenueMongo({ after: (fn) => cleanup.push(fn) }, 'delivery_customer_browser');
  const { fixture } = require('./merchantQuantityFixture');
  const data = await fixture();
  const User = require('../../models/User');
  const Tenant = require('../../models/Tenant');
  const Child = require('../../models/MerchantOrder');
  const mongoose = require('mongoose');
  const stranger = new mongoose.Types.ObjectId();
  const customer = { _id: String(data.customer), role: 'customer',
    firstName: 'Browser', lastName: 'Buyer', email: 'buyer@example.test',
    isEmailVerified: true, isAgeVerified: true };
  await User.collection.updateOne({ _id: data.customer }, { $set: customerFields(customer) });
  await User.collection.insertOne({ _id: stranger, role: 'customer', status: 'active' });
  for (const [index, tenant] of data.tenants.entries()) {
    await Tenant.collection.updateOne({ _id: tenant._id }, { $set: {
      name: `Browser shop ${index + 1}`, slug: `browser-shop-${index + 1}`,
    } });
  }
  const child = await Child.findOne({ order: data.order._id, tenant: data.actors[0].tenant }).lean();
  await require('../../services/merchantFulfillment/actions').act(child._id,
    { action: 'accept', expectedVersion: 1, idempotencyKey: 'browser-accept' }, data.actors[0]);
  await require('../../services/merchantFulfillment/quantity/commands').shipQuantities(child._id,
    { lines: [{ line: String(child.lines[0].line), quantity: 1 }],
      expectedVersion: 2, idempotencyKey: 'browser-ship-one' }, data.actors[0]);
  const sign = (userId) => jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const { encode } = require(path.resolve(__dirname, '../../../client/apps/admin/node_modules/next-auth/jwt'));
  const adminCookie = await encode({ secret: 'delivery-customer-synthetic-session-only', token: {
    id: String(data.admin._id), role: 'super_admin', accessToken: sign(data.admin._id),
    name: 'Synthetic Reviewer', email: 'reviewer@example.test',
  } });
  const tenantCookie = await encode({ secret: 'delivery-customer-synthetic-session-only', token: {
    id: String(data.actors[0]._id), role: 'tenant_owner', tenantId: String(child.tenant),
    accessToken: sign(data.actors[0]._id), plan: 'pro', subscriptionStatus: 'active',
  } });
  const app = express();
  app.use((req, res, next) => {
    if (['http://127.0.0.1:39142', 'http://127.0.0.1:39143'].includes(req.headers.origin)) {
      res.set('Access-Control-Allow-Origin', req.headers.origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,x-csrf-token');
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json());
  app.get('/__test/state', (req, res) => res.json({
    adminCookie, tenantCookie, orderId: String(data.order._id), orderNumber: data.order.orderNumber,
    customer, customerToken: sign(data.customer), strangerToken: sign(stranger),
    tenant: String(child.tenant), location: String(child.location),
  }));
  const { protect } = require('../../middleware/auth.middleware');
  app.get('/api/users/me', protect, (req, res) => res.json({ success: true,
    data: { user: { _id: String(req.user._id), ...customerFields(req.user), role: req.user.role } } }));
  app.use('/api/orders', require('../../routes/order.routes'));
  app.use('/api', require('../../routes/merchant-operations.routes'));
  app.use('/api', require('../../routes/customer-order-operations.routes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500)
    .json({ success: false, message: error.message }));
  const server = app.listen(39140, '127.0.0.1', () => console.log('delivery/customer browser fixture ready'));
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(resolve));
    for (const fn of cleanup.reverse()) await fn();
    process.exit(0);
  }
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
function customerFields(value) {
  return Object.fromEntries(['firstName', 'lastName', 'email', 'isEmailVerified', 'isAgeVerified']
    .filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
}
main().catch((error) => { console.error(error); process.exit(1); });
