'use strict';
// services/venue/package-commitments.js — Phase-4 E4 Task 2: the coordinated
// exactly-once package commitment (definitions live in packages.js, which
// re-exports this module — split purely for the <300-line discipline).
//
// DECIDED SHAPES (plan-delegated):
// - ATOMIC ALL-OR-NOTHING: tables (capacity.acquire, state 'confirmed'; the
//   claim's booking anchor is THIS commitment's id — never a synthetic Booking
//   row, never on the request queue; releaseClaim/expiry machinery untouched),
//   component stock (WarehouseStock guarded $expr reserve — the SAME rows
//   inventory.reserveBillStock guards; batch FEFO allocations frozen at commit)
//   and the included-admissions entitlement (kind 'table_inclusion') run in ONE
//   transaction: any failure rolls back EVERYTHING — 03 §7's two-phase "release
//   the other" is superseded because partial states cannot arise (asserted).
// - COMMITS RIDE THE EXISTING INTERVAL RULES: occurrence-bound commits use
//   startAt; standing commits demand an explicit bookingAt (UTC offset — the
//   validateRequest rule). Claims are future-only reservation work (the
//   Phase-2 interval() gate): committing a package at/inside a running event
//   is CAPACITY_UNAVAILABLE — staff commit before doors-open.
// - ADMISSIONS REQUIRE AN OCCURRENCE (door scans are per-occurrence): a commit
//   with includedAdmissions > 0 without occurrenceId → INVALID_INPUT.
// - UPGRADES ARE DELTA-ONLY (N09): same snapshot extended, same entitlement
//   row grown (issuedCount and its single token's partySize), same claim grown
//   (grow-only resource set); never a duplicate issuance/reservation.
// - SERVES: redeemComponent (package-lifecycle.js) — unique per
//   commitment+component+sequence, COMPONENT_EXHAUSTED beyond the snapshot
//   quantity, one physical decrement + shipped movements, FEFO frozen pieces
//   for tracked products. E5 refunds never restock served units.
// - state machine 'committed' → 'released' ('compensated' reserved for
//   operator reconciliation; never automatic).
//
// Fail codes: COMPONENT_EXHAUSTED (new, 409); reused NOT_FOUND, INVALID_INPUT,
// STATE_CHANGED, EVENT_CLOSED, CAPACITY_NOT_CONFIGURED, CAPACITY_UNAVAILABLE,
// STOCK_UNAVAILABLE, STOCK_REVIEW_REQUIRED. Commands ride runVenueOperation
// idempotency + AuditLog; actions packages.read/packages.write ('tables'
// capability — see eligibility.js ACTIONS).

const crypto = require('node:crypto');
const Commitment = require('../../models/VenuePackageCommitment');
const { loadVenueContext } = require('./context');
const { runVenueOperation } = require('./operations');
const { fail, requireId } = require('./errors');
const { id } = require('./eligibility');
const { assertNotClosed } = require('./events');
const { businessDate } = require('./clock');

function commitmentDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  const snap = row.packageSnapshot || {};
  return {
    id: id(row), locationId: id(row.location), occurrenceId: row.occurrence ? id(row.occurrence) : null,
    packageId: id(row.package), name: snap.name, state: row.state, version: row.version,
    components: (snap.components || []).map(component => ({ subProductId: id(component.subProduct), sizeId: id(component.size), quantity: component.quantity })),
    includedAdmissions: snap.includedAdmissions || 0,
    tablePlan: row.packageSnapshot?.tablePlan || {},
    tableClaimId: row.tableClaim ? id(row.tableClaim) : null,
    tableResourceIds: (row.tableResources || []).map(String),
    admissionEntitlementId: row.admissionEntitlement ? id(row.admissionEntitlement) : null,
    stockReservations: (row.stockReservations || []).map(entry => ({
      subProductId: id(entry.subProduct), sizeId: id(entry.size), quantity: entry.quantity, consumed: entry.consumed,
      batchCount: (entry.batchAllocations || []).length,
    })),
    businessDate: row.businessDate,
    releasedAt: row.releasedAt ? new Date(row.releasedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

function redemptionDTO(input) {
  const row = input && typeof input.toObject === 'function' ? input.toObject({ minimize: false }) : input;
  return {
    id: id(row), commitmentId: id(row.commitment), componentIndex: row.componentIndex,
    quantity: row.quantity, sequence: row.sequence, at: row.at ? new Date(row.at).toISOString() : null, by: id(row.by),
  };
}

function serviceWindow(location) {
  const services = location.venueServices || {};
  return { timezone: services.timezone, cutoff: services.businessDayStartMinutes == null ? 240 : services.businessDayStartMinutes };
}

async function requireOpenOccurrence(tenantId, locationId, occurrenceId, location, mongoSession) {
  const occurrence = await require('../../models/VenueEventOccurrence').findOne({ _id: occurrenceId, tenant: tenantId, location: locationId }).session(mongoSession);
  if (!occurrence) fail('NOT_FOUND', 'Event occurrence not found', 404);
  if (occurrence.publication === 'draft') fail('NOT_FOUND', 'Event occurrence not found', 404);
  assertNotClosed(occurrence.occurrenceDate, location);
  if (occurrence.publication === 'cancelled') fail('EVENT_CLOSED', 'This occurrence has been cancelled', 409);
  return occurrence;
}

function groupComponents(components) {
  const groups = new Map();
  for (const component of components) {
    const key = `${id(component.subProduct)}:${id(component.size)}`;
    const group = groups.get(key) || { subProduct: component.subProduct, size: component.size, quantity: 0 };
    group.quantity += component.quantity; groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => `${id(a.subProduct)}`.localeCompare(`${id(b.subProduct)}`));
}

// Freeze the FEFO allocation at commit (the reserveBillStock idiom); untracked
// products just carry the reservedQuantity guard.
async function reserveGroup({ tenantId, locationId, group, mongoSession }) {
  const row = await require('../../models/WarehouseStock').findOneAndUpdate(
    { tenant: tenantId, warehouse: locationId, subProduct: group.subProduct, size: group.size,
      $expr: { $gte: [{ $subtract: ['$currentQuantity', { $ifNull: ['$reservedQuantity', 0] }] }, group.quantity] } },
    { $inc: { reservedQuantity: group.quantity } }, { session: mongoSession, new: true });
  if (!row) fail('STOCK_UNAVAILABLE', 'Insufficient unreserved stock at this venue');
  await require('../warehouseStock.helpers').recalcSubProductStock(group.subProduct, mongoSession, tenantId);
  let allocations = [];
  const sub = await require('../../models/SubProduct').findOne({ _id: group.subProduct }).select('product').session(mongoSession).lean();
  const product = sub ? await require('../../models/Product').findOne({ _id: sub.product }).session(mongoSession).lean() : null;
  if (product && product.tracksBatch !== false) {
    allocations = await require('../batch.service').depleteBatchesFefo({ tenantId, warehouseId: locationId, subProduct: group.subProduct, size: group.size, quantity: group.quantity, order: 'fefo', excludeExpired: true }, mongoSession);
    if (allocations.reduce((sum, allocation) => sum + allocation.quantity, 0) !== group.quantity) fail('STOCK_UNAVAILABLE', 'Tracked stock needs complete eligible batch allocations');
  }
  return { subProduct: group.subProduct, size: group.size, quantity: group.quantity, before: row.currentQuantity, batchAllocations: allocations.map(allocation => ({ ...allocation })), consumed: 0 };
}

// Included admissions: ONE entitlement (kind 'table_inclusion'), ONE token
// (partySize = issued count, capped at the door's 50-guest single-scan batch —
// scans are sequential partial parties for larger inclusions) — upgrades grow
// exactly these, never duplicate.
async function issueInclusions({ tenantId, locationId, occurrence, snapshot, anchor, mongoSession }) {
  const [row] = await require('../../models/VenueAdmissionEntitlement').create([{
    tenant: tenantId, location: locationId, occurrence: occurrence._id,
    kind: 'table_inclusion', sourceRef: anchor, label: snapshot.name,
    issuedCount: snapshot.includedAdmissions, usedCount: 0,
    tokens: [{ token: `pk-${crypto.randomBytes(16).toString('hex')}`, partySize: Math.min(50, snapshot.includedAdmissions) }],
    agePolicySnapshot: {
      version: occurrence.version,
      ...(occurrence.agePolicy?.minimumAge == null ? {} : { minimumAge: occurrence.agePolicy.minimumAge }),
      admissionTerms: occurrence.agePolicy?.admissionTerms || '',
    },
    expiresAt: occurrence.endAt,
  }], { session: mongoSession });
  return row;
}

async function loadCapacityPolicy(tenantId, locationId, mongoSession) {
  const policy = await require('../../models/VenueCapacityPolicy').findOne({ tenant: tenantId, location: locationId, enabled: true }).session(mongoSession);
  if (!policy) fail('CAPACITY_NOT_CONFIGURED', 'Capacity is not enabled');
  return policy;
}

// The tables to claim: an explicit pick (commit-time override or the plan's
// tableIds) or a first-fit seat pick at the claimed instant (E3's
// chooseResources idiom; zones do not apply). null = the package claims none.
async function resolveTables({ tenantId, locationId, input, packageRow, bookingAt, mongoSession }) {
  const explicit = input.tableIds || (packageRow.tablePlan && packageRow.tablePlan.tableIds?.length ? packageRow.tablePlan.tableIds.map(String) : null);
  if (explicit) {
    if (new Set(explicit).size !== explicit.length) fail('INVALID_INPUT', 'Choose distinct tables', 400);
    explicit.forEach(requireId);
    return explicit;
  }
  const seatCount = packageRow.tablePlan && packageRow.tablePlan.seatCount;
  if (!seatCount) return null;
  const availability = await require('./capacity').readAvailability({ tenantId, locationId, bookingAt: new Date(bookingAt).toISOString(), partySize: seatCount }, mongoSession);
  if (!availability.options.length) fail('CAPACITY_UNAVAILABLE', 'No table matching the package plan is available at that time', 409);
  return availability.options[0].resourceIds.map(String);
}

function commitInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_INPUT', 'Commit input is required', 400);
  requireId(raw.packageId);
  if (!Number.isInteger(raw.expectedVersion) || raw.expectedVersion < 0) fail('STATE_CHANGED', 'Package version required; reload before committing');
  if (raw.occurrenceId !== undefined && raw.occurrenceId !== null) requireId(raw.occurrenceId);
  if (raw.bookingAt !== undefined && raw.bookingAt !== null && typeof raw.bookingAt !== 'string') fail('INVALID_INPUT', 'bookingAt must be an ISO instant with an explicit UTC offset', 400);
  if (raw.tableIds !== undefined && raw.tableIds !== null) {
    if (!Array.isArray(raw.tableIds) || raw.tableIds.length < 1 || raw.tableIds.length > 40) fail('INVALID_INPUT', 'tableIds is a list of 1–40 tables', 400);
  }
  return { packageId: raw.packageId, expectedVersion: raw.expectedVersion, occurrenceId: raw.occurrenceId || null, bookingAt: raw.bookingAt || null, tableIds: raw.tableIds || null };
}

async function commitPackage(args) {
  const input = commitInput(args.input);
  await loadVenueContext({ ...args, action: 'packages.write' });
  return runVenueOperation({
    targetType: 'VenuePackageCommitment', tenantId: args.tenantId, locationId: args.locationId, actor: args.actor,
    operation: 'package.commit', key: args.idempotencyKey, payload: { input },
    execute: async ({ mongoSession }) => {
      const context = await loadVenueContext({ ...args, action: 'packages.write', mongoSession });
      const packageRow = await require('../../models/VenueEventPackage').findOne({ _id: input.packageId, tenant: args.tenantId, location: args.locationId, active: true }).session(mongoSession);
      if (!packageRow) fail('NOT_FOUND', 'Package not found', 404);
      if (packageRow.version !== input.expectedVersion) fail('STATE_CHANGED', 'Package changed; reload before committing');
      // ADMISSIONS REQUIRE AN OCCURRENCE; occurrence-bound commits ride its
      // published start (standing commits name an explicit instant).
      const occurrenceId = input.occurrenceId || (packageRow.occurrence ? id(packageRow.occurrence) : null);
      let occurrence = null;
      if (occurrenceId) occurrence = await requireOpenOccurrence(args.tenantId, args.locationId, occurrenceId, context.location, mongoSession);
      else if (packageRow.includedAdmissions > 0) fail('INVALID_INPUT', 'A package with included admissions must be committed against an event occurrence', 400);
      const bookingAt = occurrence ? occurrence.startAt : (input.bookingAt || null);
      if (!bookingAt) fail('INVALID_INPUT', 'A standing package commit requires bookingAt with an explicit UTC offset', 400);
      // ONE flow (occurrence nullable): resolve tables → claim (policy loaded
      // ONLY when tables are claimed — a stock-only commit needs no capacity
      // config) → reserve components → entitlement (only when bound) → the
      // commitment row. Any failure rolls back EVERYTHING (atomic).
      const anchor = new (require('mongoose').Types.ObjectId)();
      const tableIds = await resolveTables({ tenantId: args.tenantId, locationId: args.locationId, input, packageRow, bookingAt, mongoSession });
      let claim = null;
      if (tableIds) {
        const policy = await loadCapacityPolicy(args.tenantId, args.locationId, mongoSession);
        claim = await require('./capacity').acquire({ tenantId: args.tenantId, locationId: args.locationId, bookingId: String(anchor), resourceIds: tableIds, bookingAt: new Date(bookingAt).toISOString(), partySize: (packageRow.tablePlan && packageRow.tablePlan.seatCount) || 1, policyVersion: policy.version, state: 'confirmed' }, mongoSession);
      }
      const stockReservations = [];
      for (const group of groupComponents(packageRow.components || [])) stockReservations.push(await reserveGroup({ tenantId: args.tenantId, locationId: args.locationId, group, mongoSession }));
      const snapshot = {
        name: packageRow.name, packageLine: { subProduct: packageRow.packageSubProduct, size: packageRow.size },
        components: (packageRow.components || []).map(component => ({ subProduct: component.subProduct, size: component.size, quantity: component.quantity })),
        includedAdmissions: packageRow.includedAdmissions || 0, tablePlan: packageRow.tablePlan || {},
      };
      const entitlement = occurrence && snapshot.includedAdmissions > 0 ? await issueInclusions({ tenantId: args.tenantId, locationId: args.locationId, occurrence, snapshot, anchor, mongoSession }) : null;
      const { timezone, cutoff } = serviceWindow(context.location);
      const [row] = await Commitment.create([{
        _id: anchor, tenant: args.tenantId, location: args.locationId, occurrence: occurrence ? occurrence._id : null, package: packageRow._id,
        packageSnapshot: snapshot, tableClaim: claim ? claim._id : null, tableResources: claim ? claim.resources : [],
        admissionEntitlement: entitlement ? entitlement._id : null, stockReservations,
        state: 'committed', businessDate: businessDate(new Date(bookingAt), timezone, cutoff), createdBy: args.actor.userId, version: 0,
      }], { session: mongoSession });
      return commitmentDTO(row);
    },
  });
}

async function listCommitments(args) {
  const state = args.state;
  if (state !== undefined && !['committed', 'compensated', 'released'].includes(state)) fail('INVALID_INPUT', 'Unknown commitment state filter', 400);
  await loadVenueContext({ ...args, action: 'packages.read' });
  const rows = await Commitment.find({ tenant: args.tenantId, location: args.locationId, ...(state ? { state } : {}) }).sort({ _id: -1 }).limit(51).lean();
  return { items: rows.slice(0, 50).map(commitmentDTO), next: rows.length > 50 ? id(rows[49]) : null };
}

module.exports = { commitmentDTO, redemptionDTO, serviceWindow, requireOpenOccurrence, groupComponents, reserveGroup, issueInclusions, loadCapacityPolicy, resolveTables, commitInput, commitPackage, listCommitments };
