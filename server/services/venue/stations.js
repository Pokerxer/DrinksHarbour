'use strict';
// services/venue/stations.js — station configuration CRUD (S3 Task 6 prerequisite,
// spec §2). Stations are the routing target for fired preparation items: `categories`
// are menu-item category matches, `staffIds`/`deviceIds` are opaque strings (no
// device drivers in S3 — S4 consumes deviceIds), `alertThresholdMins` drives the
// kitchen staleness clock, and `isDefault` marks the location's fallback station
// for unmapped categories.
//
// Invariants enforced here:
// - unique {tenant, location, name} (duplicate → INVALID_INPUT, like presets);
// - the location keeps AT MOST ONE default station (spec §3: "the single default
//   station") — writing isDefault: true clears the sibling flags inside the same
//   operation; unsetting it leaves none (unmapped categories then stay unrouted);
// - optimistic versioning: expectedVersion is the caller's view, drift fails
//   STATE_CHANGED, every success bumps version by 1 (batch-2 preset pattern).
//
// Eligibility: the S3 ACTIONS — 'stations.write' for mutations, 'stations.read'
// for the listing — enforced through loadVenueContext, never in the controller.
// Config editing is back-office traffic → the staffConfigurations limiter on the
// routes, mirroring presets.write.

const Station = require('../../models/PreparationStation');
const VenueLocationProfile = require('../../models/VenueLocationProfile');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { keys, text, list } = require('./experience-validation');
const crypto = require('node:crypto');

function stationDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), name: row.name,
    categories: [...(row.categories || [])], ...(row.categoryIds ? {categoryIds:[...row.categoryIds]}:{}), staffIds: [...(row.staffIds || [])], deviceIds: [...(row.deviceIds || [])],
    alertThresholdMins: row.alertThresholdMins, isDefault: !!row.isDefault, version: row.version,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

// Opaque strings per spec §2 (no drivers in S3): trimmed and bounded only —
// staffIds are compared with actor userIds, deviceIds are consumed by S4.
function opaqueId(value, name) {
  return text(value, name, 100);
}

function stationInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Station input is required', 400);
  keys(raw, ['name', 'categories', 'categoryIds', 'staffIds', 'deviceIds', 'alertThresholdMins', 'isDefault']);
  const name = text(raw.name, 'station name', 120);
  const categories = raw.categories == null ? [] : list(raw.categories, 50).map(category => text(category, 'category', 50));
  if (new Set(categories).size !== categories.length) fail('INVALID_INPUT', 'Station categories must be distinct', 400);
  const categoryIds=raw.categoryIds===undefined?undefined:list(raw.categoryIds,50).map(require('./menu-taxonomy').uuid);
  if(categoryIds&&new Set(categoryIds).size!==categoryIds.length)fail('INVALID_INPUT','Station category IDs must be distinct',400);
  const staffIds = raw.staffIds == null ? [] : list(raw.staffIds, 200).map(staffId => opaqueId(staffId, 'staff id'));
  if (new Set(staffIds).size !== staffIds.length) fail('INVALID_INPUT', 'Station staff ids must be distinct', 400);
  const deviceIds = raw.deviceIds == null ? [] : list(raw.deviceIds, 200).map(deviceId => opaqueId(deviceId, 'device id'));
  if (new Set(deviceIds).size !== deviceIds.length) fail('INVALID_INPUT', 'Station device ids must be distinct', 400);
  if (raw.alertThresholdMins !== undefined && (!Number.isInteger(raw.alertThresholdMins) || raw.alertThresholdMins < 1)) fail('INVALID_INPUT', 'alertThresholdMins is a whole number >= 1', 400);
  if (raw.isDefault !== undefined && typeof raw.isDefault !== 'boolean') fail('INVALID_INPUT', 'isDefault is a boolean', 400);
  return { name, categories, ...(categoryIds?{categoryIds}:{}), staffIds, deviceIds, alertThresholdMins: raw.alertThresholdMins ?? 15, isDefault: raw.isDefault ?? false };
}

// Spec §3 single-default invariant: at most one default station per location.
// Runs inside the operation's transaction so a racing create/update cannot leave two.
async function claimDefault(tenantId, locationId, stationId, mongoSession) {
  await Station.updateMany({ tenant: tenantId, location: locationId, isDefault: true, ...(stationId ? { _id: { $ne: stationId } } : {}) }, { $set: { isDefault: false } }, { session: mongoSession });
}

async function assertUniqueName(tenantId, locationId, name, excludeId, mongoSession) {
  const query = { tenant: tenantId, location: locationId, name };
  if (excludeId) query._id = { $ne: excludeId };
  const duplicate = await Station.findOne(query).session(mongoSession).lean();
  if (duplicate) fail('INVALID_INPUT', 'A preparation station with this name already exists at this location', 400);
}

async function assertCategoryIds(args,input,mongoSession){
  if(!input.categoryIds?.length)return;
  const profile=await VenueLocationProfile.findOne({tenant:args.tenantId,location:args.locationId}).select('menu').session(mongoSession).lean();
  const ids=new Set((profile?.menu?.categories||[]).map(c=>c.id));
  if(input.categoryIds.some(category=>!ids.has(category)))fail('NOT_FOUND','Menu category not found at this location',404);
}

async function createStation(args) {
  const input = stationInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'stations.write' });
  return runVenueOperation({
    targetType: 'PreparationStation', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'station.create', key: args.idempotencyKey, payload: { input },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'stations.write', mongoSession });
      await assertCategoryIds(args,input,mongoSession);
      await assertUniqueName(args.tenantId, args.locationId, input.name, null, mongoSession);
      if (input.isDefault) await claimDefault(args.tenantId, args.locationId, null, mongoSession);
      const [row] = await Station.create([{ tenant: args.tenantId, location: args.locationId, version: 0, ...input }], { session: mongoSession });
      return stationDTO(row);
    },
  });
}

async function updateStation(args) {
  requireId(args.stationId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Station version required; reload before saving');
  const input = stationInput(args.input);
  const context = await loadVenueContext({ ...args, action: 'stations.write' });
  return runVenueOperation({
    targetType: 'PreparationStation', tenantId: args.tenantId, locationId: args.locationId, actor: context.actor,
    operation: 'station.update', key: args.idempotencyKey, payload: { stationId: args.stationId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'stations.write', mongoSession });
      const station = await Station.findOne({ _id: args.stationId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!station) fail('NOT_FOUND', 'Preparation station not found', 404);
      if (station.version !== args.expectedVersion) fail('STATE_CHANGED', 'Station changed elsewhere; reload before saving');
      await assertCategoryIds(args,input,mongoSession);
      await assertUniqueName(args.tenantId, args.locationId, input.name, args.stationId, mongoSession);
      Object.assign(station, input, { version: args.expectedVersion + 1 });
      await station.save({ session: mongoSession });
      if (station.isDefault) await claimDefault(args.tenantId, args.locationId, station._id, mongoSession);
      return stationDTO(station);
    },
  });
}

async function listStations(args) {
  await loadVenueContext({ ...args, action: 'stations.read' });
  const rows = await Station.find({ tenant: args.tenantId, location: args.locationId }).sort({ name: 1 }).lean();
  return { items: rows.map(stationDTO) };
}

// S4 device bridge registration (spec §2): a stations.write route mints the
// 32-byte URL-safe token server-side and returns it ONCE; only its sha-256
// hash lands on VenueLocationProfile.deviceBridge. Deliberately NOT routed
// through runVenueOperation — the persisted operation result would store the
// raw token at rest, which the spec forbids ("shown once, only its hash is
// stored"). Re-registration replaces the hash, so the previous token stops
// working immediately; revoke clears the whole config.
function bridgeTokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function registerBridge(args) {
  const context = await loadVenueContext({ ...args, action: 'stations.write' });
  const token = crypto.randomBytes(32).toString('base64url');
  const registeredAt = new Date();
  const profile = await VenueLocationProfile.findOneAndUpdate(
    { tenant: args.tenantId, location: args.locationId },
    { $set: { deviceBridge: { tokenHash: bridgeTokenHash(token), registeredAt, registeredBy: context.actor.userId } } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  if (!profile) fail('NOT_FOUND', 'Location profile not found', 404);
  // The raw token appears exactly once, in THIS response — never persisted.
  return { token, registeredAt: registeredAt.toISOString() };
}

async function revokeBridge(args) {
  await loadVenueContext({ ...args, action: 'stations.write' });
  const profile = await VenueLocationProfile.findOneAndUpdate(
    { tenant: args.tenantId, location: args.locationId },
    { $set: { deviceBridge: { tokenHash: null, registeredAt: null, registeredBy: null } } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  if (!profile) fail('NOT_FOUND', 'Location profile not found', 404);
  return { registered: false };
}

module.exports = { createStation, updateStation, listStations, registerBridge, revokeBridge, stationDTO, stationInput };
