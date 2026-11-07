'use strict';
// services/venue/pour-stock.js — controlled open-bottle stock (S2, spec §4).
//
// OPEN is one explicit transaction (action 'stock.open'): the sealed unit's WarehouseStock
// row drops currentQuantity by exactly 1 under an available-unreserved guard
// ($expr: currentQuantity - reservedQuantity >= 1, mirroring reserveBillStock), a FEFO
// batch allocation of quantity 1 is copied for the consumed unit when the product tracks
// batches, and an OpenedBottle snapshot (contentsMl from the Size volumeMl) is created in
// the SAME transaction. A sealed source can never simultaneously stay sellable.
//
// POUR is a guarded decrement of remainingMl ($gte) on an ALREADY-OPENED bottle. Pours
// never auto-open: when the bottle lacks capacity the call fails STOCK_UNAVAILABLE and the
// message tells staff to open a new bottle explicitly (a separate stock.open op). When the
// remainingMl lands at 0 the bottle transitions to state 'exhausted'.
//
// WASTE is an approved, auditable drain: creating the VenueWasteEvent and draining
// remainingMl happen in the same transaction. A spill larger than the remaining ml fails;
// approval (approvedBy) and a spec §2 reason enum are required.
//
// Remainder-loss policy (documented deviation surface, default refuses): the bottle's
// implicit remainder at exhaustion is drained into the waste event only when the caller
// passes drainRemainder: true AND policyConsentRef. The event's recorded quantity is the
// ACTUAL ml drained (never more than the bottle had); a plain spill greater than the
// remaining amount still fails STOCK_UNAVAILABLE. The drained bottle is referenced in
// policyConsentRef form `opened-bottle:<id>` when the consent ref is absent.
//
// Money/cost: none — costMinorPerUnit lives on RecipeVersion, not on bottle pours.

const Stock = require('../../models/WarehouseStock');
const SubProduct = require('../../models/SubProduct');
const OpenedBottle = require('../../models/OpenedBottle');
const WasteEvent = require('../../models/VenueWasteEvent');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { recalcSubProductStock } = require('../warehouseStock.helpers');

const WASTE_REASONS = ['spill', 'remake', 'supersed-portion', 'return-outcome'];

function bottleDTO(bottle) {
  return {
    id: id(bottle),
    subProductId: id(bottle.source.subProduct),
    sizeId: id(bottle.source.size),
    batchAllocation: (bottle.batchAllocation || []).map(allocation => ({ batch: id(allocation.batch), quantity: allocation.quantity })),
    contentsMl: bottle.contentsMl,
    remainingMl: bottle.remainingMl,
    state: bottle.state,
    openedAt: bottle.openedAt ? new Date(bottle.openedAt).toISOString() : null,
  };
}

function wasteDTO(event, extra) { return { id: id(event), event: { id: id(event), reason: event.reason, quantity: event.quantity, unit: event.unit, approvedBy: event.approvedBy ? id(event.approvedBy) : null, policyConsentRef: event.policyConsentRef || null }, ...extra }; }

// ml amounts land on the controlled 2-decimal grid (units.js precision contract).
function quantizeMl(value, what) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) fail('INVALID_INPUT', `${what} must be a positive number in millilitres`, 400);
  const ml = Math.round(value * 100) / 100;
  if (ml <= 0 || Math.abs(ml - value) > 1e-9) fail('INVALID_INPUT', `${what} must be a positive millilitre number with at most two decimals`, 400);
  return ml;
}

async function loadSizeForOpen({ tenantId, subProductId, sizeId, mongoSession }) {
  const subproduct = await SubProduct.findOne({ _id: subProductId, tenant: tenantId }).session(mongoSession).lean();
  if (!subproduct) fail('NOT_FOUND', 'Stock item not found for this tenant', 404);
  const size = await require('../../models/Size').findOne({ _id: sizeId, tenant: tenantId, subproduct: subProductId }).session(mongoSession).lean();
  if (!size || !(size.volumeMl > 0)) fail('INVALID_INPUT', 'This size has no pourable volume', 400);
  return { subproduct, size };
}

// Shared open transaction body — the HTTP command and the service entry both land here.
async function openBottleAt({ tenantId, locationId, subProductId, sizeId, actor, mongoSession }) {
  requireId(subProductId); requireId(sizeId);
  const { subproduct, size } = await loadSizeForOpen({ tenantId, subProductId, sizeId, mongoSession });
  const stock = await Stock.findOneAndUpdate({ tenant: tenantId, warehouse: locationId, subProduct: subProductId, size: sizeId,
    $expr: { $gte: [{ $subtract: ['$currentQuantity', { $ifNull: ['$reservedQuantity', 0] }] }, 1] } },
  { $inc: { currentQuantity: -1 } }, { session: mongoSession, new: true });
  if (!stock) fail('STOCK_UNAVAILABLE', 'No sealed bottle available to open at this location');
  const product = await require('../../models/Product').findOne({ _id: subproduct.product }).session(mongoSession).lean();
  let allocations = [];
  if (product?.tracksBatch !== false) {
    allocations = await require('../batch.service').depleteBatchesFefo({ tenantId, warehouseId: locationId, subProduct: subProductId, size: sizeId, quantity: 1, order: 'fefo', excludeExpired: true }, mongoSession);
    if (allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) !== 1) {
      fail('STOCK_UNAVAILABLE', 'Tracked stock needs complete eligible batch allocations');
    }
  }
  const [bottle] = await OpenedBottle.create([{
    tenant: tenantId, location: locationId, source: { subProduct: subProductId, size: sizeId },
    batchAllocation: allocations, contentsMl: size.volumeMl, remainingMl: size.volumeMl,
    state: 'open', openedBy: actor.userId,
  }], { session: mongoSession });
  await recalcSubProductStock(subProductId, mongoSession, tenantId);
  return bottle;
}

async function pourAt({ tenantId, locationId, openedBottleId, ml, mongoSession }) {
  requireId(openedBottleId);
  const bottle = await OpenedBottle.findOne({ _id: openedBottleId, tenant: tenantId, location: locationId }).session(mongoSession);
  if (!bottle) fail('NOT_FOUND', 'Opened bottle not found', 404);
  if (bottle.state !== 'open') fail('STOCK_UNAVAILABLE', 'Bottle is exhausted; open a new bottle explicitly to keep pouring');
  if (bottle.remainingMl < ml) fail('STOCK_UNAVAILABLE', `${bottle.remainingMl} ml left — open a new bottle explicitly to keep pouring`);
  const updated = await OpenedBottle.findOneAndUpdate({ _id: bottle._id, tenant: tenantId, state: 'open', remainingMl: { $gte: ml } },
    { $inc: { remainingMl: -ml } }, { session: mongoSession, new: true });
  if (!updated) fail('STATE_CHANGED', 'Bottle changed concurrently; retry the pour');
  if (updated.remainingMl <= 0) {
    await OpenedBottle.updateOne({ _id: updated._id, state: 'open' }, { $set: { state: 'exhausted' } }, { session: mongoSession });
    updated.state = 'exhausted';
  }
  return updated;
}

async function drainWasteAt({ tenantId, locationId, openedBottleId, ml, reason, approvedBy, drainRemainder, policyConsentRef, actor, mongoSession }) {
  const bottle = await OpenedBottle.findOne({ _id: openedBottleId, tenant: tenantId, location: locationId }).session(mongoSession);
  if (!bottle) fail('NOT_FOUND', 'Opened bottle not found', 404);
  if (bottle.state !== 'open') fail('STOCK_UNAVAILABLE', 'Bottle is exhausted; nothing left to waste');
  if (drainRemainder) {
    if (!policyConsentRef) fail('INVALID_INPUT', 'drainRemainder requires a policyConsentRef', 400);
    ml = bottle.remainingMl; // the implicit remainder is what is recorded, never a guessed measure
  }
  if (ml > bottle.remainingMl) fail('STOCK_UNAVAILABLE', `A waste event cannot exceed the ${bottle.remainingMl} ml left in the bottle`);
  const updated = await OpenedBottle.findOneAndUpdate({ _id: bottle._id, tenant: tenantId, state: 'open', remainingMl: { $gte: ml } },
    { $inc: { remainingMl: -ml } }, { session: mongoSession, new: true });
  if (!updated) fail('STATE_CHANGED', 'Bottle changed concurrently; retry the waste');
  if (updated.remainingMl <= 0) {
    await OpenedBottle.updateOne({ _id: updated._id, state: 'open' }, { $set: { state: 'exhausted' } }, { session: mongoSession });
    updated.state = 'exhausted';
  }
  const [event] = await WasteEvent.create([{
    tenant: tenantId, location: locationId, reason, quantity: ml, unit: 'ml',
    approvedBy, policyConsentRef: policyConsentRef || `opened-bottle:${bottle._id}`, actor: actor.userId,
  }], { session: mongoSession });
  return { event, bottle: updated };
}

function venueOperation({ args, context, operation, payload, execute, targetType }) {
  return runVenueOperation({ targetType, tenantId: args.tenantId, locationId: args.locationId, actor: context.actor, operation, key: args.idempotencyKey, payload, execute });
}

// Open one sealed unit. { tenantId, locationId, subProductId, sizeId, actor, idempotencyKey }.
async function openBottle(args) {
  const context = await loadVenueContext({ ...args, action: 'stock.open' });
  return venueOperation({ args, context, targetType: 'OpenedBottle', operation: 'stock.open',
    payload: { subProductId: args.subProductId, sizeId: args.sizeId },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'stock.open', mongoSession });
      return bottleDTO(await openBottleAt({ tenantId: args.tenantId, locationId: args.locationId, subProductId: args.subProductId, sizeId: args.sizeId, actor: context.actor, mongoSession }));
    } });
}
module.exports.openBottle = openBottle;

// Pour from an already-opened bottle. { tenantId, locationId, openedBottleId, ml, actor, idempotencyKey }.
async function pour(args) {
  const ml = quantizeMl(args.ml, 'Pour amount');
  const context = await loadVenueContext({ ...args, action: 'stock.open' });
  return venueOperation({ args, context, targetType: 'OpenedBottle', operation: 'stock.pour',
    payload: { openedBottleId: args.openedBottleId, ml },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'stock.open', mongoSession });
      return bottleDTO(await pourAt({ tenantId: args.tenantId, locationId: args.locationId, openedBottleId: args.openedBottleId, ml, mongoSession }));
    } });
}
module.exports.pour = pour;

// Approved waste drain. { ..., ml, reason, approvedBy, drainRemainder?, policyConsentRef? }.
async function recordWaste(args) {
  const ml = quantizeMl(args.ml, 'Waste amount');
  if (!WASTE_REASONS.includes(args.reason)) fail('INVALID_INPUT', 'Unsupported waste reason', 400);
  if (!args.approvedBy) fail('INVALID_INPUT', 'Waste requires approval', 400);
  requireId(args.approvedBy);
  if (args.drainRemainder != null && args.drainRemainder !== true) fail('INVALID_INPUT', 'drainRemainder is a boolean policy flag', 400);
  const context = await loadVenueContext({ ...args, action: 'stock.open' });
  return venueOperation({ args, context, targetType: 'VenueWasteEvent', operation: 'stock.waste',
    payload: { openedBottleId: args.openedBottleId, ml, reason: args.reason, approvedBy: args.approvedBy, drainRemainder: args.drainRemainder === true, policyConsentRef: args.policyConsentRef || null },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'stock.open', mongoSession });
      const outcome = await drainWasteAt({ tenantId: args.tenantId, locationId: args.locationId, openedBottleId: args.openedBottleId, ml, reason: args.reason, approvedBy: args.approvedBy, drainRemainder: args.drainRemainder === true, policyConsentRef: args.policyConsentRef, actor: context.actor, mongoSession });
      return wasteDTO(outcome.event, { remainingMl: outcome.bottle.remainingMl, state: outcome.bottle.state });
    } });
}
module.exports.recordWaste = recordWaste;
// Internal seam (S2 Task 5): the fire-time pour path (consumptions.js) drains
// open bottles inside the fire transaction through this guarded decrement +
// exhaustion transition. Not an HTTP surface — `pour` above is the manual flow.
module.exports.pourAt = pourAt;
