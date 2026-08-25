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

/**
 * GET /api/pos/tables
 * The whole floor, sorted section → sortOrder → name, with each occupied
 * table's open tab summarised. All tabs are fetched with ONE Order query.
 */
exports.listTables = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenant = req.tenant._id;
  const tables = await POSTable.find({ tenant }).sort({ section: 1, sortOrder: 1, name: 1 });

  const tabIds = tables.map((tbl) => tbl.currentTabId).filter(Boolean);
  const orders = tabIds.length
    ? await Order.find({ _id: { $in: tabIds }, ...orderTenantScope(tenant) })
        .select('items holdMetadata createdAt')
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
      tab: null,
    };

    const order = tbl.currentTabId ? orderById.get(String(tbl.currentTabId)) : null;
    if (order) {
      // guests/openedAt ride in holdMetadata (Mixed) because they describe the
      // parked cart, not an order; createdAt is the fallback when the tab flow
      // never recorded an explicit open time.
      const meta = order.holdMetadata || {};
      row.tab = {
        orderId: order._id,
        guests: meta.guests,
        openedAt: meta.openedAt || order.createdAt || null,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
      };
    }

    return row;
  });

  res.json({ success: true, data: { tables: rows } });
});

/**
 * POST /api/pos/tables
 * Body: { name, section?, seats?, sortOrder? }
 */
exports.createTable = asyncHandler(async (req, res) => {
  if (venueBlocked(req, res)) return;

  const tenant = req.tenant._id;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ success: false, message: 'Table name is required' });
  }

  try {
    const table = await POSTable.create({
      tenant,
      name,
      section: req.body.section,
      seats: req.body.seats,
      sortOrder: req.body.sortOrder,
    });
    res.status(201).json({ success: true, data: { table } });
  } catch (err) {
    if (err?.code === 11000) {
      // The (tenant, name) unique index — a floor can't have two "Bar 1"s.
      return res.status(409).json({
        success: false,
        message: `a table named "${name}" already exists`,
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

  const { name, section, seats, sortOrder } = req.body;
  if (name !== undefined) table.name = typeof name === 'string' ? name.trim() : name;
  if (section !== undefined) table.section = section;
  if (seats !== undefined) table.seats = seats;
  if (sortOrder !== undefined) table.sortOrder = sortOrder;

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

  await table.deleteOne();
  res.json({ success: true });
});
