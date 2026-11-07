'use strict';
// Task 1 (E4) — package definitions + quotes. A package is a VERSIONED DEFINITION
// (VenueEventPackage) over tenant-owned SubProducts: the sellable package line
// (isVenueServiceProduct + tenant ownership), ≤12 components that must exist as
// physical stock rows at the location, optional included admissions and a table
// plan. The QUOTE prices the package line through the EXISTING priceVenueLines —
// no independent price math (03 §1) — and a quote never reserves anything.
const test = require('node:test'); const assert = require('node:assert/strict'); const mongoose = require('mongoose');
const { uri, connectVenueMongo, fixture, beverage } = require('./helpers/venueMongo');

const codeOf = error => error && error.code;
const assertFails = (promise, code, status) => assert.rejects(promise, error => codeOf(error) === code && (status === undefined || error.statusCode === status));

async function boot(t, suffix) {
  await connectVenueMongo(t, suffix);
  const args = await fixture();
  await require('../models/Warehouse').updateOne({ _id: args.locationId }, { $set: { 'venueServices.timezone': 'UTC', 'venueServices.businessDayStartMinutes': 240 } });
  for (const model of ['VenueEventPackage', 'VenueOperation']) await require(`../models/${model}`).createIndexes();
  // The sellable package line: a tenant SubProduct eligible in venue service.
  // Product mirrors the fixture's beverage style (legacy catalogKind defaults).
  const oid = () => new mongoose.Types.ObjectId();
  const product = oid(), subproduct = oid(), size = oid(); const tenant = new mongoose.Types.ObjectId(args.tenantId);
  await require('../models/Product').collection.insertOne({ _id: product, name: 'VIP Table Package', type: 'beer', isAlcoholic: true, tracksBatch: false });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 120000, defaultSize: size });
  await require('../models/Size').collection.insertOne({ _id: size, tenant, subproduct, sellingPrice: 120000 });
  const bottle = await beverage(args);
  return { ...args, packageLineId: String(subproduct), packageLineSizeId: String(size), ...bottle };
}

test('createPackage: definition lifecycle, ownership/eligibility gates, component stock existence', { skip: !uri }, async t => {
  const args = await boot(t, 'packages_def');
  const packages = require('../services/venue/packages');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  const input = {
    name: 'Platinum Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 2 }],
    includedAdmissions: 6, tablePlan: { seatCount: 6 },
  };
  const created = await packages.createPackage(base({ idempotencyKey: 'pkg-1', input }));
  assert.equal(created.name, 'Platinum Booth');
  assert.equal(created.version, 0);
  assert.equal(created.active, true);
  assert.equal(created.packageLine.subProductId, args.packageLineId);
  assert.equal(created.packageLine.sizeId, args.packageLineSizeId);
  assert.equal(created.components.length, 1);
  assert.equal(created.components[0].quantity, 2);
  assert.deepEqual(created.tablePlan, { seatCount: 6 });
  assert.equal(created.includedAdmissions, 6);
  // duplicate name → INVALID_INPUT
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-2', input })), 'INVALID_INPUT', 400);
  // unknown package line → NOT_FOUND; a line owned by ANOTHER tenant → INVALID_INPUT
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-3', input: { ...input, name: 'Ghost', packageSubProductId: String(new mongoose.Types.ObjectId()) } })), 'NOT_FOUND', 404);
  const foreignLine = await foreignPackageLine();
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-4', input: { ...input, name: 'Foreign', packageSubProductId: foreignLine.id } })), 'INVALID_INPUT', 400);
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-5', input: { ...input, name: 'WrongSize', sizeId: String(new mongoose.Types.ObjectId()) } })), 'INVALID_INPUT', 400);
  // a component without a physical stock row at this location is refused (stock-item existence)
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-6', input: { ...input, name: 'NoStock', components: [{ subProductId: String(new mongoose.Types.ObjectId()), sizeId: String(new mongoose.Types.ObjectId()), quantity: 1 }] } })), 'INVALID_INPUT', 400);
  // >12 components → INVALID_INPUT; quantity < 1 → INVALID_INPUT
  const many = Array.from({ length: 13 }, (_, index) => ({ ...input.components[0], subProductId: args.subProductId, sizeId: args.sizeId }));
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-7', input: { ...input, name: 'TooMany', components: many } })), 'INVALID_INPUT', 400);
  await assertFails(packages.createPackage(base({ idempotencyKey: 'pkg-8', input: { ...input, name: 'Zero', components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 0 }] } })), 'INVALID_INPUT', 400);
});

// A foreign package line: the SubProduct document EXISTS but is owned by another
// tenant — ownership is asserted BEFORE the product eligibility lookup, so no
// foreign Product/Tenant documents are needed.
async function foreignPackageLine() {
  const oid = () => new mongoose.Types.ObjectId();
  const foreignTenant = oid(), product = oid(), subproduct = oid(), size = oid();
  await require('../models/Product').collection.insertOne({ _id: product, name: 'Foreign Package', type: 'beer', tracksBatch: false });
  await require('../models/SubProduct').collection.insertOne({ _id: subproduct, tenant: foreignTenant, product, status: 'active', visibleInPOS: true, baseSellingPrice: 900, defaultSize: size });
  await require('../models/Size').collection.insertOne({ _id: size, tenant: foreignTenant, subproduct, sellingPrice: 900 });
  return { id: String(subproduct) };
}

test('updatePackage: version-checked; deactivate hides from the active listing; unknown → NOT_FOUND', { skip: !uri }, async t => {
  const args = await boot(t, 'packages_edit');
  const packages = require('../services/venue/packages');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  const created = await packages.createPackage(base({ idempotencyKey: 'up-0', input: {
    name: 'Gold Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 1 }], includedAdmissions: 2, tablePlan: { seatCount: 4 },
  } }));
  // stale version → STATE_CHANGED
  await assertFails(packages.updatePackage(base({ packageId: created.id, expectedVersion: 5, idempotencyKey: 'up-1', input: { includedAdmissions: 4 } })), 'STATE_CHANGED', 409);
  const updated = await packages.updatePackage(base({ packageId: created.id, expectedVersion: 0, idempotencyKey: 'up-2', input: { includedAdmissions: 4 } }));
  assert.equal(updated.includedAdmissions, 4);
  assert.equal(updated.version, 1);
  // deactivate → listing hides it
  const deactivated = await packages.updatePackage(base({ packageId: created.id, expectedVersion: 1, idempotencyKey: 'up-3', input: { active: false } }));
  assert.equal(deactivated.active, false);
  const listing = await packages.listPackages(base({}));
  assert.deepEqual(listing.items.map(row => row.id), []);
  await assertFails(packages.updatePackage(base({ packageId: String(new mongoose.Types.ObjectId()), expectedVersion: 0, idempotencyKey: 'up-4', input: {} })), 'NOT_FOUND', 404);
});

test('quotePackage: prices the package line through priceVenueLines only; a quote reserves nothing', { skip: !uri }, async t => {
  const args = await boot(t, 'packages_quote');
  const packages = require('../services/venue/packages');
  const base = over => ({ tenantId: args.tenantId, locationId: args.locationId, actor: { ...args.actor }, ...over });
  const created = await packages.createPackage(base({ idempotencyKey: 'q-0', input: {
    name: 'Silver Booth', packageSubProductId: args.packageLineId, sizeId: args.packageLineSizeId,
    components: [{ subProductId: args.subProductId, sizeId: args.sizeId, quantity: 2 }], includedAdmissions: 4, tablePlan: { seatCount: 4 },
  } }));
  const quote = await packages.quotePackage(base({ packageId: created.id }));
  assert.equal(quote.packageId, created.id);
  assert.equal(typeof quote.line.name, 'string');
  assert.equal(quote.line.subproductId, args.packageLineId);
  assert.ok(quote.line.netMinor > 0, 'the package line carries a positive net');
  assert.ok(quote.line.taxMinor >= 0);
  assert.equal(quote.components.length, 1); // component existence summary rides the quote
  const Stock = require('../models/WarehouseStock');
  const stock = await Stock.findOne({ tenant: new mongoose.Types.ObjectId(args.tenantId), subProduct: new mongoose.Types.ObjectId(args.subProductId) }).lean();
  assert.equal(stock.reservedQuantity, 2, 'a quote NEVER reserves stock');
});
