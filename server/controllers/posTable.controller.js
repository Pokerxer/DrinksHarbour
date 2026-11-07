// controllers/posTable.controller.js
//
// Back-office CRUD for the venue floor map (POSTable). Table rows are read by
// the till and reshaped from the settings screens — so these endpoints sit on
// the admin-JWT chain in pos.routes.js, never on POS tokens, and every one of
// them is gated by venueBlocked: a tenant that is not a bar/restaurant has no
// floor to manage.

const POSTable = require('../models/POSTable');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { venueBlocked } = require('../services/posVenue.service');

/**
 * Order scoping for tab lookups, inlined from pos.controller.js's private
 * `tenantScope` helper. Both fields are matched deliberately: the root
 * `tenant` field was added to the Order schema long after `items.tenant`
 * existed (see git history), so orders parked before it was declared carry
 * only the per-item copy — matching either keeps that history reachable.
 */
function orderTenantScope(tenantId) {
  return { $or: [{ tenant: tenantId }, { 'items.tenant': tenantId }] };
}

// ── Floor-table field validation (server-side, mirroring the UI constraints) ──
// The workspace enforces these in the form; the API must enforce them too.
// Bounds: name 1–50 chars (matches the themed floor planner name input),
// section ≤50 chars, seats 1–40 covers single stools up to the largest
// banquet combination the canvas layout supports, sortOrder −10000..10000.
// Every failure returns a message with the cause and how to fix it.
const TABLE_FIELD_LIMITS = { nameMax: 50, sectionMax: 50, seatsMax: 40, sortOrderLimit: 10000 };
// Throws are intentional at call sites that stand behind asyncHandler; both
// floor-controllers translate a failure into the same 400 JSON envelope the
// endpoints have always returned ({ success:false, message }) — see
// createTable/updateTable keep the historical 400 JSON envelope for these
// failures — see their try/catch around the validator.
function validateFloorTableFields(input, { partial = false } = {}) {
  const fail = (message) => { const error = new Error(message); error.statusCode = 400; error.isOperational = true; error.code = 'INVALID_INPUT'; throw error; };
  const output = {};
  const name = input.name;
  if (name === undefined) {
    if (!partial) fail('Table name is required; give the floor label exactly as the till should show it');
  } else {
    if (typeof name !== 'string') fail('Table name must be text; use a plain label like "Lounge 4"');
    if (!name.trim()) fail('Table name cannot be empty; give the floor label exactly as the till should show it');
    if (name.trim().length > TABLE_FIELD_LIMITS.nameMax) fail(`Table name is limited to ${TABLE_FIELD_LIMITS.nameMax} characters (received ${name.trim().length}); shorten the label`);
    else output.name = name.trim();
  }
  if (input.section !== undefined) {
    if (typeof input.section !== 'string') fail('Section must be text; use the zone label from the floor planner');
    if (input.section.trim().length > TABLE_FIELD_LIMITS.sectionMax) fail(`Section is limited to ${TABLE_FIELD_LIMITS.sectionMax} characters; shorten the zone label`);
    else output.section = input.section.trim();
  }
  if (input.seats !== undefined) {
    if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > TABLE_FIELD_LIMITS.seatsMax) {
      fail(`Seats must be an integer from 1 to ${TABLE_FIELD_LIMITS.seatsMax}; check the chair count for this table`);
    } else output.seats = input.seats;
  }
  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < -TABLE_FIELD_LIMITS.sortOrderLimit || input.sortOrder > TABLE_FIELD_LIMITS.sortOrderLimit) {
      fail(`sortOrder must be an integer between −${TABLE_FIELD_LIMITS.sortOrderLimit} and ${TABLE_FIELD_LIMITS.sortOrderLimit}`);
    } else output.sortOrder = input.sortOrder;
  }
  return output;
}

/**
 * GET /api/pos/tables
 * The whole floor, sorted section → sortOrder → name, with each occupied
 * table's open tab summarised. All tabs are fetched with ONE Order query.
 */
exports.listTables = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenant = req.tenant._id;
  if (req.tenant.venueSettings?.identityVersion === 1 && req.user?.venueDeniedActions?.includes('tables.read')) require('../services/venue/errors').fail('VENUE_PERMISSION_DENIED', 'Table access denied', 403);
  let filter = { tenant };
  if (req.tenant.venueSettings?.identityVersion === 1 && !['tenant_owner', 'tenant_admin', 'admin', 'super_admin'].includes(req.user?.role)) {
    const locations = await require('../models/Warehouse').find({ tenant, isActive: true, venueStaff: req.user._id }).select('_id').lean();
    filter.location = { $in: locations.map(row => row._id) };
  }
  const tables = await POSTable.find(filter).sort({ section: 1, sortOrder: 1, name: 1 }).lean();

  const tabIds = tables.map((tbl) => tbl.currentTabId).filter(Boolean);
  const orders = tabIds.length
    ? await Order.find({ _id: { $in: tabIds }, ...orderTenantScope(tenant) })
        .select('items holdMetadata createdAt venueServiceSession venueIdentityVersion')
        .lean()
    : [];
  const orderById = new Map(orders.map((o) => [String(o._id), o]));

  const rows = tables.map((tbl) => {
    const row = {
      _id: tbl._id,
      name: tbl.name,
      section: tbl.section,
      seats: tbl.seats,
      sortOrder: tbl.sortOrder,
      status: tbl.status,
      currentTabId: tbl.currentTabId,
      location: tbl.location, venueVersion: tbl.venueVersion,
      tab: null,
    };

    const order = tbl.currentTabId ? orderById.get(String(tbl.currentTabId)) : null;
    if (order) {
      // guests/openedAt ride in holdMetadata (Mixed) because they describe the
      // parked cart, not an order; createdAt is the fallback when the tab flow
      // never recorded an explicit open time.
      const meta = order.holdMetadata || {};
      // Kitchen-round counts come straight off the already-fetched doc — pure
      // aggregation, no extra queries. The till's tabs panel reads this to show
      // "T3 · 2 rounds · 1 ready" without touching the kitchen board endpoint.
      const rounds = Array.isArray(meta.firedRounds) ? meta.firedRounds : [];
      const countBy = (status) => rounds.filter((r) => r && r.status === status).length;
      row.tab = {
        orderId: order._id,
        ...(order.venueServiceSession ? { serviceSessionId: order.venueServiceSession, identityVersion: order.venueIdentityVersion } : {}),
        guests: meta.guests,
        openedAt: meta.openedAt || order.createdAt || null,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        rounds: {
          total: rounds.length,
          active: rounds.filter((r) => r && r.status !== 'served').length,
          pending: countBy('pending'),
          preparing: countBy('preparing'),
          ready: countBy('ready'),
        },
      };
    }

    return row;
  });

  res.json({ success: true, data: { tables: rows } });
});

exports.TABLE_FIELD_LIMITS = TABLE_FIELD_LIMITS;
exports.validateFloorTableFields = validateFloorTableFields;

/**
 * POST /api/pos/tables
 * Body: { name, section?, seats?, sortOrder? }
 */
exports.createTable = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenant = req.tenant._id;
  let fields;
  try { fields = validateFloorTableFields(req.body, { partial: false }); }
  catch (error) {
    // Original contract: validation failures are plain 400 JSON, nothing thrown.
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    throw error;
  }

  try {
    const table = await POSTable.create({ tenant, ...fields });
    res.status(201).json({ success: true, data: { table } });
  } catch (err) {
    if (err?.code === 11000) {
      // The (tenant, name) unique index — a floor can't have two "Bar 1"s.
      return res.status(409).json({
        success: false,
        message: `a table named "${fields.name ?? req.body.name}" already exists`,
      });
    }
    throw err;
  }
});

/**
 * PUT /api/pos/tables/:id
 * Accepts only name/section/seats/sortOrder. Status and currentTabId are
 * owned by the open/settle flows — editing them here would desync a table
 * from the very order that makes it occupied.
 */
exports.updateTable = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  if (req.body.status !== undefined || req.body.currentTabId !== undefined) {
    return res.status(400).json({
      success: false,
      message: 'table status changes happen through open/settle flows',
    });
  }

  const table = await POSTable.findOne({ _id: req.params.id, tenant: req.tenant._id });
  if (!table) {
    return res.status(404).json({ success: false, message: 'Table not found' });
  }

  if (table.capacityManaged) require('../services/venue/errors').fail('CAPACITY_CONFIGURATION_REQUIRED', 'Disable capacity after resolving commitments before changing this table');
  // Only validated, explicitly-sent fields mutate; invalid values return a
  // 400 that names the cause instead of clobbering the record.
  let fields;
  try { fields = validateFloorTableFields(req.body, { partial: true }); }
  catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    throw error;
  }
  for (const [key, value] of Object.entries(fields)) table[key] = value;
  if (!table.name || !table.name.trim()) {
    return res.status(400).json({ success: false, message: 'Table name is required; give the floor label exactly as the till should show it' });
  }

  try {
    await table.save();
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: `a table named "${table.name}" already exists`,
      });
    }
    throw err;
  }

  res.json({ success: true, data: { table } });
});

/**
 * DELETE /api/pos/tables/:id
 * A table holding a live tab cannot be deleted out from under its bill.
 */
exports.deleteTable = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const table = await POSTable.findOne({ _id: req.params.id, tenant: req.tenant._id });
  if (!table) {
    return res.status(404).json({ success: false, message: 'Table not found' });
  }

  if (table.status === 'occupied' || table.currentTabId) {
    return res.status(400).json({ success: false, message: 'table has an open tab' });
  }

  if (table.capacityManaged) require('../services/venue/errors').fail('CAPACITY_CONFIGURATION_REQUIRED', 'Disable capacity after resolving commitments before deleting this table');
  const removed = await POSTable.deleteOne({ _id: table._id, tenant: req.tenant._id, __v: table.__v, capacityManaged: { $ne: true }, status: { $ne: 'occupied' }, currentTabId: null });
  if (!removed.deletedCount) require('../services/venue/errors').fail('STATE_CHANGED', 'Table changed; refresh');
  res.json({ success: true });
});
