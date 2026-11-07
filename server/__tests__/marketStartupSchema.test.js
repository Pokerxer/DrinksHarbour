'use strict';
const { test } = require('node:test'),
  assert = require('node:assert/strict');
for (const name of ['CountryConfiguration', 'SalesChannel', 'MerchantDeliveryQuote', 'MerchantShipment', 'MerchantShipmentEvent'])
  test(`${name} leaves index creation to reviewed preparation`, () => {
    const Model = require(`../models/${name}`);
    assert.equal(Model.schema.options.autoIndex, false);
  });
