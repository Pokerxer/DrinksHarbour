'use strict';
const mongoose = require('mongoose');
const assert = require('node:assert/strict');
const uri = process.env.DRINKSHARBOUR_VENUE_TEST_MONGO_URI;
async function connectVenueMongo(t, suffix) {
  assert.match(uri || '', /^mongodb:\/\/127\.0\.0\.1:29127\/drinks_venue_test_[\w]+\?replicaSet=venuePhase0$/);
  const base = uri.split('?')[0];
  await mongoose.connect(`${base}?directConnection=true`, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  const admin = mongoose.connection.db.admin();
  try { await admin.command({ replSetGetStatus: 1 }); }
  catch (error) {
    if (error.code !== 94) throw error;
    await admin.command({ replSetInitiate: { _id: 'venuePhase0', members: [{ _id: 0, host: '127.0.0.1:29127' }] } });
  }
  await mongoose.disconnect();
  const ownedUri = uri.replace('?', `_${suffix}_${process.pid}?`);
  await mongoose.connect(ownedUri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
}
async function fixture() {
  const oid = () => new mongoose.Types.ObjectId();
  const tenant = oid(), location = oid(), userId = oid();
  await require('../../models/Tenant').collection.insertOne({ _id: tenant, status: 'approved', isActive: true, plan: 'venue', subscriptionStatus: 'active', businessCapabilities: ['hospitality'], posSettings: { isBarRestaurant: true }, venueSettings: { identityVersion: 1, commercialTerms: { version: 1, platformRateBps: 900, directRateBps: 0, effectiveAt: new Date() } } });
  await require('../../models/Warehouse').create({ _id: location, tenant, name: 'Bar', code: 'BAR', venueServices: { enabled: true, reviewedAt: new Date(), canonicalCheckoutEnabled: true, capabilities: ['tables', 'tabs', 'preparation'] }, venueStaff: [userId] });
  await require('../../models/User').collection.insertOne({ _id: userId, tenant, role: 'tenant_owner', status: 'active', venueDeniedActions: [] });
  const table = await require('../../models/POSTable').create({ tenant, location, name: 'Table 1' });
  return { tenantId: String(tenant), locationId: String(location), tableIds: [String(table._id)], expectedTableVersions: [0], actor: { userId: String(userId), tenantId: String(tenant), role: 'tenant_owner', permissions: ['pos:sell'], venueDeniedActions: [] } };
}
module.exports = { uri, connectVenueMongo, fixture };
async function beverage(args, { currentQuantity = 10, reservedQuantity = 2 } = {}) {
  const oid = () => new mongoose.Types.ObjectId();
  const product = oid(), subproduct = oid(), size = oid(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../../models/Product').collection.insertOne({ _id: product, name: 'Bottle', type: 'beer', isAlcoholic: true, tracksBatch: false });
  await require('../../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 1000, defaultSize: size, costPrice: 500 });
  await require('../../models/Size').collection.insertOne({ _id: size, tenant, subproduct, sellingPrice: 1000, costPrice: 500 });
  await require('../../models/WarehouseStock').create({ tenant, warehouse: args.locationId, subProduct: subproduct, size, currentQuantity, reservedQuantity });
  return { subProductId: String(subproduct), sizeId: String(size), quantity: 3 };
}
module.exports.beverage = beverage;
