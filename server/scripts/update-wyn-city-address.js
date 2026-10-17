'use strict';
require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const apply = process.argv.includes('--apply');
const tenantId = new mongoose.Types.ObjectId('699165839f3308b1baeca8fc');
// Verified Google Geocoding ROOFTOP result, 2026-10-12; not a city centroid.
const address = {
  street: '39 Gana Street', city: 'Abuja', state: 'Abuja', country: 'Nigeria',
  zipCode: '900001',
  formatted: '39 Gana St, Maitama, Abuja 900001, Federal Capital Territory, Nigeria',
};
const omitLocation = row => {
  const { address, location, normalizedState, updatedAt, ...rest } = row;
  return rest;
};
async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const scope = { _id: tenantId, slug: 'wyncity', name: 'Wyn City' };
      const options = { session };
      const before = await db.collection('tenants').findOne(scope, options);
      if (!before) throw new Error('Exact Wyn City tenant not found');
      const location = { lat: 9.0782337, lon: 7.5004871, source: 'google', geocodedAt: new Date() };
      const patch = { location, normalizedState: 'FCT - Abuja', updatedAt: new Date() };
      for (const [key, value] of Object.entries(address)) patch[`address.${key}`] = value;
      const candidate = new Tenant(before);
      candidate.set(patch);
      const error = candidate.validateSync(Object.keys(patch));
      if (error) throw error;
      const expected = { address: { ...before.address, ...address }, location, normalizedState: 'FCT - Abuja' };
      result = { mode: apply ? 'applied' : 'dry-run', tenantId, slug: before.slug,
        before: { address: before.address, location: before.location || null, normalizedState: before.normalizedState }, after: expected };
      if (!apply) return;
      const changed = await db.collection('tenants').updateOne({ ...scope, updatedAt: before.updatedAt }, { $set: patch }, options);
      assert.equal(changed.matchedCount, 1, 'Tenant changed concurrently');
      const after = await db.collection('tenants').findOne(scope, options);
      assert.deepEqual(after.address, expected.address);
      assert.deepEqual(after.location, location);
      assert.deepEqual(omitLocation(after), omitLocation(before), 'Unrelated tenant fields changed');
      const audit = await db.collection('auditlogs').insertOne({
        actorRole: 'system', action: 'TENANT_UPDATE', actionCategory: 'update',
        targetType: 'Tenant', targetId: tenantId, targetTenantId: tenantId,
        justification: 'User requested Wyn City location: 39 Gana Street, Abuja. Exact Google ROOFTOP geocode verified.',
        changes: { before: result.before, after: expected }, result: 'success', timestamp: new Date(),
      }, options);
      result.auditId = audit.insertedId;
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await session.endSession(); }
}
main().catch(error => { console.error(error.name, error instanceof assert.AssertionError ? error.message : 'Address update failed'); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
