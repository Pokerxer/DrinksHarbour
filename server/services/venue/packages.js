'use strict';
// services/venue/packages.js — Phase-4 E4 Task 1: package definitions + quotes.
//
// DECIDED SHAPES (plan-delegated):
// - tableRequirements → `tablePlan {tableIds?: [], seatCount?}`: an explicit
//   policy-resource pick or a first-fit seat count resolved at commit time;
//   both optional, neither = the package reserves no tables.
// - The QUOTE is priceVenueLines ONLY (03 §1 "No arbitrary MenuItem.price") on
//   the package's own line — the commit-time price never diverges from the
//   canonical machine; a quote reserves NOTHING (asserted in tests).
// - Component stock existence is a WarehouseStock-row check at the location —
//   the same rows inventory.reserveBillStock guards; NO second stock pool.
// - Eligibility: packages.read/packages.write ride the location's 'tables'
//   capability (a package IS a table-promise + inclusion offer — the E3
//   waitlists precedent; documented in eligibility.js ACTIONS).
//
// This module owns definitions + quoting only. Commitments (the coordinated
// exactly-once reservations) live in package-commitments.js, and their
// post-commit life (serves/upgrades/releases) in package-lifecycle.js — both
// re-exported here so packages.js is the service surface (split purely for the
// <300-line discipline).

const Package = require('../../models/VenueEventPackage');
const Stock = require('../../models/WarehouseStock');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');

function packageDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), locationId: id(row.location), occurrenceId: row.occurrence ? id(row.occurrence) : null,
    name: row.name, active: row.active !== false, version: row.version,
    packageLine: { subProductId: id(row.packageSubProduct), sizeId: id(row.size) },
    components: (row.components || []).map(component => ({
      subProductId: id(component.subProduct), sizeId: id(component.size), quantity: component.quantity,
    })),
    includedAdmissions: row.includedAdmissions || 0,
    tablePlan: row.tablePlan ? {
      ...(row.tablePlan.tableIds?.length ? { tableIds: row.tablePlan.tableIds.map(String) } : {}),
      ...(row.tablePlan.seatCount ? { seatCount: row.tablePlan.seatCount } : {}),
    } : {},
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

// The package line: tenant-owned, sellable, venue-service eligible.
async function requirePackageLine(tenantId, packageSubProductId, sizeId, mongoSession) {
  const sp = await require('../../models/SubProduct').findOne({ _id: packageSubProductId }).session(mongoSession).lean();
  if (!sp) fail('NOT_FOUND', 'Package beverage not found', 404);
  if (id(sp.tenant) !== tenantId) fail('INVALID_INPUT', 'The package line must be a tenant-owned product', 400);
  if (!sp.visibleInPOS || ['discontinued', 'hidden', 'archived'].includes(sp.status)) fail('INVALID_INPUT', 'The package line must be an actively listed product', 400);
  const product = await require('../../models/Product').findOne({ _id: sp.product }).session(mongoSession).lean();
  if (!require('../../constants/catalogKind').isVenueServiceProduct(product)) fail('INVALID_INPUT', 'Item is not eligible in venue service', 422);
  const size = await require('../../models/Size').findOne({ _id: sizeId, subproduct: packageSubProductId, tenant: sp.tenant }).session(mongoSession).lean();
  if (!size) fail('INVALID_INPUT', 'The package size must belong to the package product', 400);
  return { sp, product, size };
}

function componentInput(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', `Component ${index} is malformed`, 400);
  requireId(raw.subProductId); requireId(raw.sizeId);
  if (!Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > 100) fail('INVALID_INPUT', `Component ${index} quantity must be 1–100`, 400);
  return { subProduct: raw.subProductId, size: raw.sizeId, quantity: raw.quantity };
}

function tablePlanInput(raw) {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'tablePlan must be an object', 400);
  const plan = {};
  if (raw.tableIds !== undefined && raw.tableIds !== null) {
    if (!Array.isArray(raw.tableIds) || raw.tableIds.length < 1 || raw.tableIds.length > 40) fail('INVALID_INPUT', 'tablePlan.tableIds is a list of 1–40 tables', 400);
    plan.tableIds = raw.tableIds.map(requireId);
  }
  if (raw.seatCount !== undefined && raw.seatCount !== null) {
    if (!Number.isInteger(raw.seatCount) || raw.seatCount < 1 || raw.seatCount > 100) fail('INVALID_INPUT', 'tablePlan.seatCount must be 1–100', 400);
    plan.seatCount = raw.seatCount;
  }
  return plan;
}

// Ownership + shape checks shared by create/update. Component stock EXISTENCE
// (a WarehouseStock row at this location per component pair) runs afterwards.
function definitionInput(raw, { partial = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Package input is required', 400);
  const input = {};
  if (!partial || raw.name !== undefined) {
    if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 120) fail('INVALID_INPUT', 'A package name of 1–120 characters is required', 400);
    input.name = raw.name.trim();
  }
  if (!partial || raw.packageSubProductId !== undefined) {
    requireId(raw.packageSubProductId); requireId(raw.sizeId);
    input.packageSubProductId = raw.packageSubProductId; input.sizeId = raw.sizeId;
  }
  if (!partial || raw.components !== undefined) {
    if (!Array.isArray(raw.components) || raw.components.length < 1 || raw.components.length > 12) fail('INVALID_INPUT', 'A package carries 1–12 components', 400);
    input.components = raw.components.map(componentInput);
  }
  if (!partial || raw.includedAdmissions !== undefined) {
    if (!Number.isInteger(raw.includedAdmissions) || raw.includedAdmissions < 0 || raw.includedAdmissions > 100) fail('INVALID_INPUT', 'includedAdmissions must be 0–100', 400);
    input.includedAdmissions = raw.includedAdmissions;
  }
  if (!partial || raw.tablePlan !== undefined) input.tablePlan = tablePlanInput(raw.tablePlan);
  if (raw.occurrenceId !== undefined && raw.occurrenceId !== null) { requireId(raw.occurrenceId); input.occurrenceId = raw.occurrenceId; }
  return input;
}

// Every component pair must exist as PHYSICAL stock at the location (03 §4:
// components are tracked stock, never untracked free items). A missing row is
// an input problem — the tenant must receive/stock the component first.
async function assertComponentStockRows(tenantId, locationId, components, mongoSession) {
  for (const component of components) {
    const row = await Stock.findOne({ tenant: tenantId, warehouse: locationId, subProduct: component.subProduct, size: component.size }).select('_id').session(mongoSession).lean();
    if (!row) fail('INVALID_INPUT', 'Component has no stock row at this location; receive or stock it first', 400);
  }
}

async function createPackage(args) {
  const input = definitionInput(args.input);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenueEventPackage', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.create', key: args.idempotencyKey, payload: { input },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      await requirePackageLine(args.tenantId, input.packageSubProductId, input.sizeId, mongoSession);
      await assertComponentStockRows(args.tenantId, args.locationId, input.components, mongoSession);
      if (input.occurrenceId) {
        const occurrence = await require('../../models/VenueEventOccurrence').findOne({ _id: input.occurrenceId, tenant: args.tenantId, location: args.locationId }).session(mongoSession).lean();
        if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
      }
      const duplicate = await Package.exists({ tenant: args.tenantId, location: args.locationId, name: input.name }).session(mongoSession);
      if (duplicate) fail('INVALID_INPUT', 'A package with this name already exists at this location', 400);
      const [row] = await Package.create([{
        tenant: args.tenantId, location: args.locationId,
        occurrence: input.occurrenceId || null, name: input.name,
        packageSubProduct: input.packageSubProductId, size: input.sizeId,
        components: input.components, includedAdmissions: input.includedAdmissions,
        tablePlan: input.tablePlan, active: true, version: 0,
      }], { session: mongoSession });
      return packageDTO(row);
    },
  });
}

async function updatePackage(args) {
  requireId(args.packageId);
  const partial = definitionInput(args.input, { partial: true });
  if (args.input.active !== undefined && typeof args.input.active !== 'boolean') fail('INVALID_INPUT', 'active is a boolean', 400);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenueEventPackage', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.update', key: args.idempotencyKey, payload: { packageId: args.packageId, expectedVersion: args.expectedVersion, input: partial },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      const row = await Package.findOne({ _id: args.packageId, tenant: args.tenantId, location: args.locationId }).session(mongoSession);
      if (!row) fail('NOT_FOUND', 'Package not found', 404);
      if (row.version !== args.expectedVersion) fail('STATE_CHANGED', 'Package changed; reload before updating');
      // replaces: full-replace fields when present (a partial definition would
      // otherwise leave a half-valid record); whole-row snapshot governs commits.
      if (partial.name !== undefined) row.name = partial.name;
      if (partial.packageSubProductId !== undefined) {
        await requirePackageLine(args.tenantId, partial.packageSubProductId, partial.sizeId, mongoSession);
        row.packageSubProduct = partial.packageSubProductId; row.size = partial.sizeId;
      }
      if (partial.components !== undefined) { await assertComponentStockRows(args.tenantId, args.locationId, partial.components, mongoSession); row.components = partial.components; }
      if (partial.includedAdmissions !== undefined) row.includedAdmissions = partial.includedAdmissions;
      if (partial.tablePlan !== undefined) row.tablePlan = partial.tablePlan;
      if (partial.occurrenceId !== undefined) row.occurrence = partial.occurrenceId || null;
      if (args.input.active !== undefined) row.active = args.input.active === true;
      row.version += 1;
      await row.save({ session: mongoSession });
      return packageDTO(row);
    },
  });
}

async function listPackages(args) {
  await loadVenueContext({ ...args, action: 'packages.read' });
  const rows = await Package.find({ tenant: args.tenantId, location: args.locationId, active: true }).sort({ name: 1, _id: 1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(packageDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

async function quotePackage(args) {
  requireId(args.packageId);
  const context = await loadVenueContext({ ...args, action: 'packages.read' });
  const row = await Package.findOne({ _id: args.packageId, tenant: args.tenantId, location: args.locationId, active: true }).lean();
  if (!row) fail('NOT_FOUND', 'Package not found', 404);
  // The canonical pricing machine — quantity 1 of the package's own line.
  const lines = await require('./pricing').priceVenueLines({
    tenant: context.tenant, location: context.location, actor: context.actor,
    lines: [{ subProductId: id(row.packageSubProduct), sizeId: id(row.size), quantity: 1 }],
  });
  const line = lines[0];
  return {
    packageId: id(row), name: row.name, version: row.version,
    line: { name: line.name, subproductId: id(line.subproduct), sizeId: line.size ? id(line.size) : null, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor, netMinor: line.netMinor, taxRate: line.taxRate, taxMinor: line.taxMinor },
    components: (row.components || []).map(componentDTO => ({ subProductId: id(componentDTO.subProduct), sizeId: id(componentDTO.size), quantity: componentDTO.quantity })),
    includedAdmissions: row.includedAdmissions || 0,
    tablePlan: row.tablePlan || {},
  };
}

module.exports = { packageDTO, definitionInput, tablePlanInput, createPackage, updatePackage, listPackages, quotePackage,
  ...require('./package-commitments'),
  ...require('./package-lifecycle') };
