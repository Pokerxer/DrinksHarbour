'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  mongoose = require('mongoose');
const { uri, connectVenueMongo } = require('./helpers/venueMongo');
test(
  'merchant queue gives only own canonical item names and permitted recipient details',
  { skip: !uri },
  async (t) => {
    await connectVenueMongo(t, 'merchant_projection');
    const Child = require('../models/MerchantOrder'),
      Order = require('../models/Order'),
      service = require('../services/merchantFulfillment');
    const oid = () => new mongoose.Types.ObjectId(),
      tenant = oid(),
      foreign = oid(),
      parent = oid(),
      location = oid(),
      a = oid(),
      b = oid(),
      product = oid(),
      subproduct = oid(),
      size = oid();
    await require('../models/Product').collection.insertOne({
      _id: product,
      name: 'Own drink',
    });
    await require('../models/SubProduct').collection.insertOne({
      _id: subproduct,
      tenant,
      product,
      sku: 'OWN',
    });
    await require('../models/Size').collection.insertOne({
      _id: size,
      tenant,
      subproduct,
      displayName: 'Small',
    });
    await Order.collection.insertOne(
      new Order({
        _id: parent,
        orderNumber: 'OWN_REFERENCE',
        user: oid(),
        totalAmount: 999,
        paymentDetails: { privateProvider: 'secret' },
        shippingAddress: {
          fullName: 'Recipient',
          phone: '08000000000',
          addressLine1: 'Synthetic collection',
          city: 'Abuja',
          state: 'FCT',
          country: 'Nigeria',
          email: 'private@example.test',
        },
        items: [
          {
            fulfillmentLineId: a,
            tenant,
            warehouse: location,
            product,
            subproduct,
            size,
            productName: 'Own drink',
            sizeName: 'Small',
            sku: 'OWN',
            costPrice: 12,
          },
          {
            fulfillmentLineId: b,
            tenant: foreign,
            warehouse: oid(),
            productName: 'PRIVATE_COMPETING_ITEM',
            sizeName: 'Foreign',
            sku: 'FOREIGN',
          },
        ],
      }).toObject()
    );
    await Child.collection.insertOne({
      _id: 'own',
      order: parent,
      tenant,
      location,
      currency: 'NGN',
      state: 'pending',
      lines: [
        {
          line: a,
          product,
          subproduct,
          size,
          quantity: 1,
          tenantShareMinor: 20,
          commissionMinor: 10,
        },
        { line: b, quantity: 1 },
      ],
    });
    await Child.collection.insertOne({
      _id: 'foreign',
      order: parent,
      tenant: foreign,
      location: oid(),
      lines: [],
    });
    const actor = { _id: oid(), role: 'tenant_owner', tenant };
    const rows = await service.list(actor);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].lines[0].productName, 'Own drink');
    assert.equal(rows[0].lines[0].sizeName, 'Small');
    assert.equal(rows[0].lines[0].sku, 'OWN');
    assert.equal(rows[0].recipient.fullName, 'Recipient');
    assert.equal(rows[0].recipient.phone, '08000000000');
    assert.equal(rows[0].recipient.email, undefined);
    assert.equal(rows[0].orderNumber, 'OWN_REFERENCE');
    for (const secret of [
      'PRIVATE_COMPETING_ITEM',
      'private@example.test',
      'tenantShareMinor',
      'commissionMinor',
      'privateProvider',
      'costPrice',
    ])
      assert.equal(JSON.stringify(rows).includes(secret), false, secret);
    const detail = await service.get('own', actor);
    assert.deepEqual(detail, rows[0]);
  }
);
