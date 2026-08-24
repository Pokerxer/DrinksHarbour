// controllers/stockTransfer.controller.js
const asyncHandler = require("express-async-handler");
const StockTransfer = require("../models/StockTransfer");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const Warehouse = require("../models/Warehouse");
const warehouseService = require("../services/warehouse.service");
const {
  resolveTransferUnitCost,
  hasExplicitUnitCost,
} = require("../services/stockTransfer.helpers");
const { computeTransferMoney } = require("../services/stockTransfer.money");
const {
  receiveStockTransferLines,
} = require("../services/stockTransferReceive");
const { captureDocumentTax, reverseDocumentTax } = require("../services/tax.service");
const { getTenantWarehouseSettings } = require("./warehouse.controller");
const { NotFoundError, ValidationError, ForbiddenError } = require("../utils/errors");

const resolveTenantId = (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.tenant) {
    const t = req.user.tenant;
    return typeof t === "object" && t._id ? t._id : t;
  }
  throw new ForbiddenError("Tenant context required");
};

// Two-sided workflow: source managers dispatch, destination managers receive.
// These roles always bypass the per-warehouse manager check.
const TENANT_BYPASS_ROLES = ["super_admin", "tenant_owner", "tenant_admin"];

function isWarehouseSideUser(warehouse, req) {
  if (req.user && TENANT_BYPASS_ROLES.includes(req.user.role)) return true;
  const ids = (warehouse?.managers || []).map((m) =>
    typeof m === "object" ? String(m._id ?? m) : String(m)
  );
  return ids.includes(String(req.user._id));
}

async function assertWarehouseSide(warehouseId, tenantId, req, label) {
  if (TENANT_BYPASS_ROLES.includes(req.user.role)) return;
  const wh = await Warehouse.findOne({ _id: warehouseId, tenant: tenantId })
    .select("managers")
    .lean();
  if (!isWarehouseSideUser(wh, req)) {
    throw new ForbiddenError(
      `Only a manager of the ${label} warehouse (or a tenant admin) can do this`
    );
  }
}

async function generateTransferNumber(tenantId) {
  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;
  const last = await StockTransfer.findOne({
    tenant: tenantId,
    transferNumber: new RegExp(`^${prefix}`),
  })
    .sort({ transferNumber: -1 })
    .select("transferNumber")
    .lean();
  const seq = last
    ? parseInt(String(last.transferNumber).split("-")[2], 10) + 1
    : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

async function enrichItems(items, tenantId) {
  if (!items?.length) return items;
  return Promise.all(
    items.map(async (item) => {
      const enriched = { ...item };
      if (item.subProductId) {
        const sp = await SubProduct.findOne({
          _id: item.subProductId,
          tenant: tenantId,
        })
          .populate("product", "name")
          .lean();
        if (sp) {
          if (!enriched.subProductName)
            enriched.subProductName = sp.product?.name ?? sp.sku;
          if (!enriched.sku) enriched.sku = sp.sku;

          // The Size that prices this line: the one chosen, or — for a
          // sub-product sold without size variants — its default size, which
          // is where its wholesale/cost price actually lives.
          const pricingSizeId = item.sizeId || sp.defaultSize;
          const sz = pricingSizeId
            ? await Size.findOne({ _id: pricingSizeId }).lean()
            : null;
          if (item.sizeId && sz && !enriched.sizeName) enriched.sizeName = sz.size;

          // The server owns the default so `totalValue` — and with it the
          // approval threshold — can't be dodged by a client that omits price.
          if (!hasExplicitUnitCost(enriched.costPrice)) {
            enriched.costPrice = resolveTransferUnitCost({
              size: sz,
              subProduct: sp,
            });
          }
        }
      }
      return enriched;
    })
  );
}

// POST /api/stock-transfers
const createStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const userId = req.user._id;
  const {
    sourceWarehouse,
    destinationWarehouse,
    items,
    notes,
    scheduledDate,
    status,
    currency,
    deliveryCharge,
  } = req.body;

  if (!sourceWarehouse || !destinationWarehouse)
    throw new ValidationError("Source and destination warehouses are required");
  if (String(sourceWarehouse) === String(destinationWarehouse))
    throw new ValidationError("Source and destination must be different warehouses");
  if (!items?.length)
    throw new ValidationError("At least one item is required");

  const settings = await getTenantWarehouseSettings(tenantId);
  if (!settings.allowInterWarehouseTransfers)
    throw new ValidationError("Inter-warehouse transfers are disabled for this tenant");

  const enriched = await enrichItems(items, tenantId);
  const transferNumber = await generateTransferNumber(tenantId);

  const transferItems = enriched.map((it) => ({
    ...it,
    subProductName: it.subProductName ?? it.productName ?? "",
    transferredQty: 0,
    receivedQty: 0,
    discountRate: Number(it.discountRate) || 0,
    taxRate: Number(it.taxRate) || 0,
    packSize: Math.max(1, Math.floor(Number(it.packSize) || 1)),
  }));
  const draft = { items: transferItems, deliveryCharge: Number(deliveryCharge) || 0 };
  applyTransferMoney(draft);
  const totalValue = draft.total;

  // A create-and-confirm that meets the approval threshold lands in
  // pending_approval rather than confirmed.
  let resolvedStatus = status === "confirmed" ? "confirmed" : "draft";
  if (
    resolvedStatus === "confirmed" &&
    settings.requireTransferApproval &&
    draft.total >= (settings.transferApprovalThreshold || 0)
  ) {
    resolvedStatus = "pending_approval";
  }

  const transfer = await StockTransfer.create({
    tenant: tenantId,
    transferNumber,
    sourceWarehouse,
    destinationWarehouse,
    items: transferItems,
    notes,
    scheduledDate,
    status: resolvedStatus,
    totalValue,
    deliveryCharge: draft.deliveryCharge,
    subtotal: draft.subtotal,
    discountAmount: draft.discountAmount,
    taxAmount: draft.taxAmount,
    total: draft.total,
    currency: currency || "NGN",
    createdBy: userId,
    ...(resolvedStatus === "confirmed"
      ? { confirmedBy: userId, confirmedAt: new Date() }
      : {}),
  });

  res.status(201).json({ success: true, data: transfer });
});

// GET /api/stock-transfers
const getStockTransfers = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const { status, page = 1, limit = 20, search } = req.query;

  const query = { tenant: tenantId };
  if (status) query.status = status;
  if (search) query.transferNumber = new RegExp(search, "i");

  const skip = (Number(page) - 1) * Number(limit);
  const [transfers, total, stats] = await Promise.all([
    StockTransfer.find(query)
      .populate("sourceWarehouse", "name code type address contact managers")
      .populate("destinationWarehouse", "name code type address contact managers")
      .populate("createdBy", "name")
      .populate("confirmedBy", "name")
      .populate("completedBy", "name")
      .populate("cancelledBy", "name")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    StockTransfer.countDocuments(query),
    StockTransfer.aggregate([
      { $match: { tenant: tenantId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const statsMap = { draft: 0, pending_approval: 0, confirmed: 0, in_transit: 0, partially_received: 0, completed: 0, cancelled: 0, rejected: 0 };
  for (const s of stats) statsMap[s._id] = s.count;

  res.json({
    success: true,
    data: transfers,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
    stats: statsMap,
  });
});

// GET /api/stock-transfers/:id
const getStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    tenant: tenantId,
  })
    .populate("sourceWarehouse", "name code type address contact managers")
    .populate("destinationWarehouse", "name code type address contact managers")
    .populate("createdBy", "name")
    .populate("confirmedBy", "name")
    .populate("completedBy", "name")
    .populate("cancelledBy", "name")
    .populate("approvedBy", "name")
    .populate("rejectedBy", "name")
    .lean();
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  res.json({ success: true, data: transfer });
});

// PATCH /api/stock-transfers/:id
const updateStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (transfer.status !== "draft")
    throw new ValidationError("Only draft transfers can be edited");

  const {
    sourceWarehouse,
    destinationWarehouse,
    items,
    notes,
    scheduledDate,
    currency,
    deliveryCharge,
  } = req.body;

  if (sourceWarehouse) transfer.sourceWarehouse = sourceWarehouse;
  if (destinationWarehouse) transfer.destinationWarehouse = destinationWarehouse;
  if (notes !== undefined) transfer.notes = notes;
  if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
  if (currency) transfer.currency = currency;
  if (deliveryCharge !== undefined)
    transfer.deliveryCharge = Number(deliveryCharge) || 0;
  if (items) {
    const enriched = await enrichItems(items, tenantId);
    transfer.items = enriched.map((it) => ({
      ...it,
      subProductName: it.subProductName ?? it.productName ?? "",
      transferredQty: 0,
      receivedQty: 0,
      discountRate: Number(it.discountRate) || 0,
      taxRate: Number(it.taxRate) || 0,
      packSize: Math.max(1, Math.floor(Number(it.packSize) || 1)),
    }));
  }

  if (
    String(transfer.sourceWarehouse) === String(transfer.destinationWarehouse)
  )
    throw new ValidationError("Source and destination must be different warehouses");

  applyTransferMoney(transfer);
  await transfer.save();
  res.json({ success: true, data: transfer });
});

// DELETE /api/stock-transfers/:id
const deleteStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (transfer.status !== "draft")
    throw new ValidationError("Only draft transfers can be deleted");
  await transfer.deleteOne();
  res.json({ success: true, message: "Transfer deleted" });
});

// Money snapshot recomputed on every write. `total` is authoritative;
// `totalValue` mirrors it so the approval gate and any legacy reader agree.
function applyTransferMoney(t) {
  const m = computeTransferMoney(t.items || [], t.deliveryCharge || 0);
  t.subtotal = m.subtotal;
  t.discountAmount = m.discountAmount;
  t.taxAmount = m.taxAmount;
  t.total = m.total;
  t.totalValue = m.total;
  return m;
}

// Allowed status transitions for PATCH /:id/status. Send / Receive / Close run
// on dedicated endpoints (:id/send |receive|close), so in_transit is reached
// only by dispatching and partially_received only by receiving — neither is a
// generic status transition here. The legacy direct confirmed→completed move
// (which moved all stock at once) was removed in favour of that flow.
const TRANSITIONS = {
  draft: ["confirmed", "cancelled"],
  pending_approval: ["cancelled"], // approve/reject use dedicated endpoints
  confirmed: ["in_transit", "cancelled"],
  in_transit: ["cancelled"],       // receiving/closing have dedicated endpoints
  partially_received: [],
  completed: [],
  cancelled: [],
  rejected: [],
};

// Verify the source warehouse holds enough of every line before committing.
async function assertSourceStock(transfer, tenantId, WarehouseStock) {
  for (const item of transfer.items) {
    const q = {
      tenant: tenantId,
      warehouse: transfer.sourceWarehouse,
      subProduct: item.subProductId,
    };
    if (item.sizeId) q.size = item.sizeId;
    const stock = await WarehouseStock.findOne(q).lean();
    const available = stock?.currentQuantity ?? 0;
    if (available < item.quantity) {
      throw new ValidationError(
        `Insufficient stock for "${item.subProductName}"${item.sizeName ? ` (${item.sizeName})` : ""}: ` +
          `${available} available, ${item.quantity} requested`
      );
    }
  }
}

// PATCH /api/stock-transfers/:id/approve
// Approve a pending_approval transfer → moves it to confirmed (with a fresh
// source-stock check). Records the approver.
const approveStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const userId = req.user._id;
  const transfer = await StockTransfer.findOne({ _id: req.params.id, tenant: tenantId });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (transfer.status !== "pending_approval") {
    throw new ValidationError("Only transfers awaiting approval can be approved");
  }

  const WarehouseStock = require("../models/WarehouseStock");
  await assertSourceStock(transfer, tenantId, WarehouseStock);

  transfer.approvedBy = userId;
  transfer.approvedAt = new Date();
  transfer.confirmedBy = userId;
  transfer.confirmedAt = new Date();
  transfer.status = "confirmed";
  await transfer.save();

  res.json({ success: true, data: transfer, message: "Transfer approved" });
});

// PATCH /api/stock-transfers/:id/reject
// Reject a pending_approval transfer with an optional reason.
const rejectStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const userId = req.user._id;
  const { reason = "" } = req.body;
  const transfer = await StockTransfer.findOne({ _id: req.params.id, tenant: tenantId });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (transfer.status !== "pending_approval") {
    throw new ValidationError("Only transfers awaiting approval can be rejected");
  }

  transfer.rejectedBy = userId;
  transfer.rejectedAt = new Date();
  transfer.rejectionReason = String(reason).slice(0, 500);
  transfer.status = "rejected";
  await transfer.save();

  res.json({ success: true, data: transfer, message: "Transfer rejected" });
});

// PATCH /api/stock-transfers/:id/status
const updateStockTransferStatus = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const userId = req.user._id;
  const { status } = req.body;

  const transfer = await StockTransfer.findOne({
    _id: req.params.id,
    tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");

  if (!TRANSITIONS[transfer.status]?.includes(status)) {
    throw new ValidationError(
      `Cannot transition from '${transfer.status}' to '${status}'`
    );
  }

  const WarehouseStock = require("../models/WarehouseStock");

  if (status === "confirmed") {
    // Approval gate: when the tenant requires approval and this transfer's value
    // meets the threshold, route it to pending_approval instead of confirming.
    // An already-approved transfer (approvedAt set) skips the gate.
    const settings = await getTenantWarehouseSettings(tenantId);
    applyTransferMoney(transfer);
    if (
      settings.requireTransferApproval &&
      transfer.total >= (settings.transferApprovalThreshold || 0) &&
      !transfer.approvedAt
    ) {
      transfer.status = "pending_approval";
      await transfer.save();
      return res.json({
        success: true,
        data: transfer,
        message: "Transfer submitted for approval",
      });
    }

    await assertSourceStock(transfer, tenantId, WarehouseStock);
    transfer.confirmedBy = userId;
    transfer.confirmedAt = new Date();
  }

  if (status === "cancelled") {
    if (
      ["in_transit", "partially_received"].includes(transfer.status) &&
      (transfer.receipts || []).length > 0
    ) {
      throw new ValidationError(
        "Stock has already been received against this transfer — it cannot be cancelled"
      );
    }
    transfer.cancelledBy = userId;
    transfer.cancelledAt = new Date();
  }

  transfer.status = status;
  await transfer.save();

  if (status === "cancelled") {
    reverseDocumentTax({ sourceType: 'stock_transfer', doc: transfer, userId });
  }

  res.json({ success: true, data: transfer });
});

// POST /api/stock-transfers/:id/send — source side dispatches the goods.
const sendStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id, tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (transfer.status !== "confirmed")
    throw new ValidationError("Only confirmed transfers can be sent");
  await assertWarehouseSide(transfer.sourceWarehouse, tenantId, req, "source");

  const WarehouseStock = require("../models/WarehouseStock");
  await assertSourceStock(transfer, tenantId, WarehouseStock);

  applyTransferMoney(transfer);
  transfer.dispatchedBy = req.user._id;
  transfer.dispatchedAt = new Date();
  transfer.status = "in_transit";
  await transfer.save();
  res.json({ success: true, data: transfer, message: "Transfer dispatched" });
});

// POST /api/stock-transfers/:id/receive — destination side books a receipt.
const receiveStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id, tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (!["in_transit", "partially_received"].includes(transfer.status))
    throw new ValidationError("Only dispatched transfers can be received");
  await assertWarehouseSide(transfer.destinationWarehouse, tenantId, req, "destination");

  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  if (!lines.length) throw new ValidationError("At least one received quantity is required");

  await receiveStockTransferLines({ transfer, tenantId, userId: req.user._id, lines });

  for (const l of lines) {
    const item = transfer.items[Number(l.itemIndex)];
    item.receivedQty = (item.receivedQty || 0) + Number(l.quantity);
    item.transferredQty = item.receivedQty; // legacy alias
  }
  transfer.receipts.push({
    receivedBy: req.user._id,
    receivedAt: new Date(),
    lines: lines.map((l) => ({
      itemIndex: Number(l.itemIndex),
      quantity: Number(l.quantity),
      ...(l.note ? { note: String(l.note).slice(0, 300) } : {}),
    })),
  });

  const allIn = transfer.items.every(
    (it) => (it.receivedQty || 0) >= (it.quantity || 0)
  );
  transfer.status = allIn ? "completed" : "partially_received";
  if (allIn) {
    transfer.completedDate = new Date();
    transfer.completedBy = req.user._id;
  }
  await transfer.save();
  if (allIn) {
    // Full receipt completes the transfer here rather than via /close —
    // capture the tax snapshot on this path too.
    captureDocumentTax({ sourceType: 'stock_transfer', doc: transfer, postedBy: req.user._id });
  }
  res.json({
    success: true, data: transfer,
    message: allIn ? "Transfer fully received" : "Receipt recorded",
  });
});

// POST /api/stock-transfers/:id/close — close with documented shortage.
const closeStockTransfer = asyncHandler(async (req, res) => {
  const tenantId = resolveTenantId(req);
  const transfer = await StockTransfer.findOne({
    _id: req.params.id, tenant: tenantId,
  });
  if (!transfer) throw new NotFoundError("Stock transfer not found");
  if (!["in_transit", "partially_received"].includes(transfer.status))
    throw new ValidationError("Only in-flight transfers can be closed");
  if (!(transfer.receipts || []).length)
    throw new ValidationError("Record at least one receipt before closing");
  await assertWarehouseSide(transfer.sourceWarehouse, tenantId, req, "source")
    .catch(() => {});
  await assertWarehouseSide(transfer.destinationWarehouse, tenantId, req, "destination");

  for (const it of transfer.items) {
    it.shortfallQty = Math.max(0, (it.quantity || 0) - (it.receivedQty || 0));
  }
  transfer.closedWithShortage = true;
  transfer.receipts.push({
    receivedBy: req.user._id,
    receivedAt: new Date(),
    lines: [],
    shortagesClosed: true,
  });
  transfer.completedDate = new Date();
  transfer.completedBy = req.user._id;
  transfer.status = "completed";
  await transfer.save();
  captureDocumentTax({ sourceType: 'stock_transfer', doc: transfer, postedBy: req.user._id });
  res.json({ success: true, data: transfer, message: "Transfer closed" });
});

module.exports = {
  createStockTransfer,
  getStockTransfers,
  getStockTransfer,
  updateStockTransfer,
  deleteStockTransfer,
  updateStockTransferStatus,
  approveStockTransfer,
  rejectStockTransfer,
  sendStockTransfer,
  receiveStockTransfer,
  closeStockTransfer,
  TRANSITIONS,
  isWarehouseSideUser,
};
