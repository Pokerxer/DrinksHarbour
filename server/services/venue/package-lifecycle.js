'use strict';
// services/venue/package-lifecycle.js — Phase-4 E4 Task 2 (post-commit life):
// tracked SERVES, DELTA-ONLY upgrades, staff RELEASE. See
// package-commitments.js for the commit invariant (atomic all-or-nothing) and
// code documentation; this module adds:
//
// - SERVE (redeemComponent): component-level bound = the redemption SUM per
//   componentIndex vs the snapshot quantity (COMPONENT_EXHAUSTED); stock
//   decrements use the consumeBillStock PAIR (currentQuantity AND
//   reservedQuantity down), guarded so a serve can never pass the physical/
//   reserved pool (STOCK_REVIEW_REQUIRED to reconcile); the pair's FROZEN FEFO
//   allocations (from commit) deplete pieces-first for batch-tracked products;
//   shipped WarehouseMovement + InventoryMovement (referenceType 'manual',
//   source 'system', NO relatedOrder — packages are not orders) rows record
//   the physical event; unique {tenant, commitment, componentIndex, sequence}
//   keeps concurrent serves honest.
// - UPGRADE (upgradeCommitment): the SAME snapshot extended (components
//   append), the SAME entitlement row grown (issuedCount += delta, its ONE
//   token's partySize += delta; usedCount ≤ issuedCount always), the SAME
//   claim row amended (JOIN-ONLY resource set via the existing acquire anchor).
//   ≤8 components per call, ≤100 units per line; an explicit delta may repeat
//   under a fresh key (the operator asked for more).
// - RELEASE (releaseCommitment): stock remainder (pair quantity − pair
//   consumed) returned via a guarded reservedQuantity decrement; the table
//   claim released through the EXISTING capacity path (arrived → STATE_CHANGED);
//   the inclusion entitlement frozen (expiresAt moved EARLIER only) so
//   unredeemed admissions can never scan afterwards; replay is idempotent.
//
// Fail codes: COMPONENT_EXHAUSTED (new, 409); reused NOT_FOUND, INVALID_INPUT,
// STATE_CHANGED, STOCK_REVIEW_REQUIRED, CAPACITY_UNAVAILABLE, EVENT_CLOSED.
// Commands ride runVenueOperation idempotency + AuditLog; actions ride
// 'packages.write' (the 'tables' capability — see eligibility.js ACTIONS).

const Commitment = require('../../models/VenuePackageCommitment');
const Redemption = require('../../models/VenuePackageRedemption');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const commitments = require('./package-commitments');

function lifeInput(raw, shape) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', `${shape} input is required`, 400);
  return raw;
}

function addedComponentsInput(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) fail('INVALID_INPUT', 'addedComponents is 1–8 components', 400);
  return raw.map((component, index) => {
    if (!component || typeof component !== 'object') fail('INVALID_INPUT', `Component ${index} is malformed`, 400);
    requireId(component.subProductId); requireId(component.sizeId);
    if (!Number.isInteger(component.quantity) || component.quantity < 1 || component.quantity > 100) fail('INVALID_INPUT', `Component ${index} quantity must be 1–100`, 400);
    return { subProduct: component.subProductId, size: component.sizeId, quantity: component.quantity };
  });
}

function upgradeInput(raw) {
  const input = lifeInput(raw, 'Upgrade');
  const added = {};
  if (input.addedAdmissions !== undefined) {
    if (!Number.isInteger(input.addedAdmissions) || input.addedAdmissions < 1 || input.addedAdmissions > 100) fail('INVALID_INPUT', 'addedAdmissions must be 1–100', 400);
    added.addedAdmissions = input.addedAdmissions;
  }
  if (input.addedComponents !== undefined) added.addedComponents = addedComponentsInput(input.addedComponents);
  if (input.addedTableIds !== undefined) {
    if (!Array.isArray(input.addedTableIds) || input.addedTableIds.length < 1 || input.addedTableIds.length > 40) fail('INVALID_INPUT', 'addedTableIds is a list of 1–40 tables', 400);
    input.addedTableIds.forEach(requireId);
    added.addedTableIds = input.addedTableIds;
  }
  if (!added.addedAdmissions && !added.addedComponents && !added.addedTableIds) fail('INVALID_INPUT', 'An upgrade names a delta: addedAdmissions, addedComponents and/or addedTableIds', 400);
  return added;
}

async function upgradeCommitment(args) {
  requireId(args.commitmentId);
  if (!Number.isInteger(args.expectedVersion) || args.expectedVersion < 0) fail('STATE_CHANGED', 'Commitment version required; reload before upgrading');
  const input = upgradeInput(args.input);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenuePackageCommitment', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.upgrade', key: args.idempotencyKey, payload: { commitmentId: args.commitmentId, expectedVersion: args.expectedVersion, input },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      const row = await Commitment.findOne({ _id: args.commitmentId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Package commitment not found', 404);
      if (row.state !== 'committed') fail('STATE_CHANGED', 'Only committed packages upgrade', 409);
      if (row.version !== args.expectedVersion) fail('STATE_CHANGED', 'Commitment changed; reload before upgrading');
      if (row.occurrence) await commitments.requireOpenOccurrence(args.tenantId, args.locationId, id(row.occurrence), context.location, mongoSession);
      else if (input.addedAdmissions) fail('INVALID_INPUT', 'Admission upgrades require an occurrence (the door scans per event)', 400);
      // DELTA-ONLY admissions: the same entitlement row grows (issuedCount and
      // its ONE token's partySize). usedCount ≤ issuedCount always holds.
      if (input.addedAdmissions) {
        const entitlement = await require('../../models/VenueAdmissionEntitlement').findOne({ _id: row.admissionEntitlement, tenant: args.tenantId }).session(mongoSession);
        if (!entitlement) fail('STOCK_REVIEW_REQUIRED', 'The commitment entitlement needs reconciliation');
        const raised = await require('../../models/VenueAdmissionEntitlement').updateOne(
          { _id: entitlement._id, tenant: args.tenantId, usedCount: { $lte: entitlement.issuedCount } },
          { $inc: { issuedCount: input.addedAdmissions }, $set: { 'tokens.0.partySize': Math.min(50, entitlement.issuedCount + input.addedAdmissions) } }, { session: mongoSession });
        if (!raised.modifiedCount) fail('STATE_CHANGED', 'The inclusion allowance changed; reload before upgrading');
        row.packageSnapshot.includedAdmissions += input.addedAdmissions;
      }
      // DELTA-ONLY components: new reservations join the pair ledger, snapshot appends.
      for (const component of input.addedComponents || []) {
        if (row.packageSnapshot.components.length >= 20) fail('INVALID_INPUT', 'A commitment carries at most 20 component lines', 400);
        const reservation = await commitments.reserveGroup({ tenantId: args.tenantId, locationId: args.locationId, group: component, mongoSession });
        row.stockReservations.push(reservation);
        row.packageSnapshot.components.push({ subProduct: component.subProduct, size: component.size, quantity: component.quantity });
      }
      // DELTA-ONLY tables: JOIN-ONLY — the claim is amended on the same anchor
      // row; a table already in the plan cannot be "re-added".
      if (input.addedTableIds) {
        if (!row.tableClaim) fail('INVALID_INPUT', 'This commitment holds no tables; release and recommit with a table plan', 400);
        const claim = await require('../../models/VenueCapacityClaim').findOne({ _id: row.tableClaim, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
        if (!claim || !['held', 'confirmed'].includes(claim.state)) fail('STATE_CHANGED', 'The table claim changed; reload before upgrading');
        const duplicates = input.addedTableIds.filter(tableId => (row.tableResources || []).map(String).includes(tableId));
        if (duplicates.length) fail('INVALID_INPUT', 'A package plan already includes that table', 400);
        const amended = await require('./capacity').acquire({
          tenantId: args.tenantId, locationId: args.locationId, bookingId: id(row),
          resourceIds: [...claim.resources.map(String), ...input.addedTableIds],
          bookingAt: claim.bookingAt.toISOString(), partySize: row.packageSnapshot.tablePlan.seatCount || 1,
          policyVersion: claim.policyVersion, expectedVersion: claim.version, state: 'confirmed',
        }, mongoSession);
        row.tableResources = amended.resources.map(String);
      }
      row.version += 1;
      await row.save({ session: mongoSession });
      return commitments.commitmentDTO(row);
    },
  });
}

async function releaseCommitment(args) {
  requireId(args.commitmentId);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenuePackageCommitment', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.release', key: args.idempotencyKey, payload: { commitmentId: args.commitmentId },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      const row = await Commitment.findOne({ _id: args.commitmentId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Package commitment not found', 404);
      if (row.state === 'released') return commitments.commitmentDTO(row); // replay-safe
      if (row.state !== 'committed') fail('STATE_CHANGED', 'This commitment can no longer be released', 409);
      // stock remainder back: pair quantity − pair consumed; the guarded
      // decrement refuses an underflow (the reservation row was touched).
      for (const entry of row.stockReservations || []) {
        const remainder = entry.quantity - (entry.consumed || 0);
        if (remainder <= 0) continue;
        const restored = await require('../../models/WarehouseStock').findOneAndUpdate(
          { tenant: args.tenantId, subProduct: entry.subProduct, size: entry.size,
            $expr: { $gte: ['$reservedQuantity', remainder] } },
          { $inc: { reservedQuantity: -remainder } }, { session: mongoSession });
        if (!restored) fail('STOCK_REVIEW_REQUIRED', 'The reserved component pool needs reconciliation');
        await require('../warehouseStock.helpers').recalcSubProductStock(entry.subProduct, mongoSession, args.tenantId);
      }
      if (row.tableClaim) await require('./capacity').releaseClaim({ tenantId: args.tenantId, locationId: args.locationId, bookingId: id(row) }, mongoSession);
      if (row.admissionEntitlement) {
        const entitlement = await require('../../models/VenueAdmissionEntitlement').findOne({ _id: row.admissionEntitlement, tenant: args.tenantId }).session(mongoSession);
        // MOVE-EARLIER-ONLY: a release may freeze admissions, never revive them.
        if (entitlement && (!entitlement.expiresAt || entitlement.expiresAt > new Date())) {
          entitlement.expiresAt = new Date();
          entitlement.markModified('expiresAt');
          await entitlement.save({ session: mongoSession });
        }
      }
      row.state = 'released'; row.releasedAt = new Date(); row.releasedBy = args.actor.userId; row.version += 1;
      await row.save({ session: mongoSession });
      return commitments.commitmentDTO(row);
    },
  });
}

// Serve an included component: one physical decrement, one redemption row.
async function redeemComponent(args) {
  requireId(args.commitmentId);
  const input = lifeInput(args.input, 'Serve');
  if (!Number.isInteger(input.componentIndex) || input.componentIndex < 0 || input.componentIndex > 20) fail('INVALID_INPUT', 'componentIndex is a 0-based integer', 400);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) fail('INVALID_INPUT', 'quantity must be 1–100', 400);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenuePackageRedemption', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.redeem', key: args.idempotencyKey, payload: { commitmentId: args.commitmentId, input: { componentIndex: input.componentIndex, quantity: input.quantity } },
    execute: async ({ mongoSession }) => {
      await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      const row = await Commitment.findOne({ _id: args.commitmentId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Package commitment not found', 404);
      if (row.state !== 'committed') fail('STATE_CHANGED', 'Serves belong to committed packages only', 409);
      const component = (row.packageSnapshot.components || [])[input.componentIndex];
      if (!component) fail('INVALID_INPUT', 'Unknown component for this commitment', 400);
      const servedRows = await Redemption.aggregate([
        { $match: { tenant: new (require('mongoose').Types.ObjectId)(args.tenantId), commitment: row._id, componentIndex: input.componentIndex } },
        { $group: { _id: null, total: { $sum: '$quantity' } } },
      ]).session(mongoSession);
      const servedTotal = servedRows[0] ? servedRows[0].total : 0;
      if (servedTotal + input.quantity > component.quantity) fail('COMPONENT_EXHAUSTED', `This component was included ${component.quantity}× in the package`, 409);
      // the physical decrement: pair-level (the consumeBillStock pair)
      const entry = (row.stockReservations || []).find(candidate => `${id(candidate.subProduct)}:${id(candidate.size)}` === `${String(component.subProduct)}:${String(component.size)}`);
      if (!entry) fail('STOCK_REVIEW_REQUIRED', 'The component reservation needs reconciliation');
      const stock = await require('../../models/WarehouseStock').findOneAndUpdate(
        { tenant: args.tenantId, warehouse: row.location, subProduct: entry.subProduct, size: entry.size,
          $expr: { $and: [{ $gte: ['$currentQuantity', input.quantity] }, { $gte: ['$reservedQuantity', input.quantity] }] } },
        { $inc: { currentQuantity: -input.quantity, reservedQuantity: -input.quantity } }, { session: mongoSession, new: true });
      if (!stock) fail('STOCK_REVIEW_REQUIRED', 'The component stock has moved beyond its reservation; reconcile before serving');
      await require('../warehouseStock.helpers').recalcSubProductStock(entry.subProduct, mongoSession, args.tenantId);
      const product = await require('../../models/Product').findOne({ _id: (await require('../../models/SubProduct').findOne({ _id: entry.subProduct }).select('product').session(mongoSession).lean()).product }).session(mongoSession).lean();
      const drained = [];
      if (product && product.tracksBatch !== false) {
        let left = input.quantity;
        const pieces = entry.batchAllocations || [];
        while (left > 0 && pieces.length) {
          const piece = pieces[0]; const take = Math.min(left, piece.quantity);
          piece.quantity -= take; left -= take; drained.push({ batch: piece.batch, quantity: take });
          if (piece.quantity === 0) pieces.shift();
        }
        if (left > 0) fail('STOCK_REVIEW_REQUIRED', 'The frozen batch allocation needs reconciliation');
      }
      const reference = `venuepackage:${id(row)}:${Date.now()}`;
      const [movement] = await require('../../models/WarehouseMovement').create([{
        tenant: args.tenantId, warehouse: row.location, subProduct: entry.subProduct, size: entry.size,
        type: 'shipped', quantity: input.quantity, balanceBefore: stock.currentQuantity + input.quantity,
        balanceAfter: stock.currentQuantity, stockChange: -input.quantity, reference, performedBy: args.actor.userId,
      }], { session: mongoSession });
      const [inventory] = await require('../../models/InventoryMovement').create([{
        tenant: args.tenantId, warehouse: row.location, subProduct: entry.subProduct, size: entry.size, product: product._id,
        type: 'shipped', category: 'out', quantity: input.quantity, quantityBefore: stock.currentQuantity + input.quantity,
        quantityAfter: stock.currentQuantity, reference, referenceType: 'manual', source: 'system', status: 'confirmed',
        performedBy: args.actor.userId, performedAt: new Date(),
      }], { session: mongoSession });
      entry.consumed = (entry.consumed || 0) + input.quantity;
      const prior = await Redemption.countDocuments({ tenant: args.tenantId, commitment: row._id, componentIndex: input.componentIndex }).session(mongoSession);
      try {
        const [redemption] = await Redemption.create([{
          tenant: args.tenantId, location: row.location, commitment: row._id, componentIndex: input.componentIndex,
          quantity: input.quantity, sequence: prior + 1, movements: [id(movement), id(inventory)], batchAllocations: drained, by: args.actor.userId,
        }], { session: mongoSession });
        await row.save({ session: mongoSession });
        return commitments.redemptionDTO(redemption);
      } catch (error) {
        if (error && error.code === 11000) fail('STATE_CHANGED', 'Another serve of this component landed first; retry with a fresh key', 409);
        throw error;
      }
    },
  });
}

module.exports = { upgradeCommitment, releaseCommitment, redeemComponent };
