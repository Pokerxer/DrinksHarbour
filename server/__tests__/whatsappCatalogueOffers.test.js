'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const SubProduct = require('../models/SubProduct');
const warehouseDefaults = require('../services/marketplaceDefaultWarehouse');
const warehouseStock = require('../services/marketplaceWarehouseStock');

test('quotes Woodford from cost and checkout warehouse stock without exposing cost', async (t) => {
  const product = { _id: '507f1f77bcf86cd7994390011' };
  const tenant = { _id: 'tenant', name: 'Wyn City', status: 'approved', subscriptionStatus: 'active',
    revenueModel: 'markup', markupPercentage: 0 };
  const size = { _id: 'size', tenant: 'tenant', subproduct: 'listing', size: '70cl',
    sku: 'WOODFORD-70CL', costPrice: 6000, sellingPrice: 20000, availableStock: 0 };
  const listing = { _id: 'listing', product, tenant, status: 'active', costPrice: 5000,
    sizes: [size, { ...size, _id: 'inactive', status: 'inactive' }, { ...size, _id: 'foreign', tenant: 'foreign' }] };
  t.mock.method(SubProduct, 'find', (query) => {
    assert.equal(query.isPublished, true);
    assert.deepEqual(query.visibleInOnlineStore, { $ne: false });
    return { select: () => ({ populate: () => ({ lean: async () => [listing] }) }) };
  });
  t.mock.method(warehouseDefaults, 'resolveCheckoutDefault', async () => 'default-warehouse');
  t.mock.method(warehouseStock, 'scopeOffers', async (offers) => {
    assert.deepEqual(offers[0].tenant.warehouseSettings.marketplaceWarehouses, ['default-warehouse']);
    return offers.map(offer => ({ ...offer, sizes: offer.sizes.map(size => ({ ...size, availableStock: 103 })) }));
  });
  const { getWhatsappOffers } = require('../services/whatsappCatalogueOffers');
  const rows = await getWhatsappOffers([product._id]);
  assert.deepEqual(rows.map(row => row.sizes.map(size => size.sizeId)), [['size']]);
  assert.equal(rows[0].sizes[0].availableStock, 103);
  assert.equal(rows[0].tenantName, 'Wyn City');
  assert.ok(rows[0].sizes[0].marketplacePrice >= 6000);
  assert.equal(Object.hasOwn(rows[0].sizes[0], 'costPrice'), false);
});
