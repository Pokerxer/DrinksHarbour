// controllers/stockTransfer.controller.js
const asyncHandler = require("express-async-handler");
const StockTransfer = require("../models/StockTransfer");
const SubProduct = require("../models/SubProduct");
const Size = require("../models/Size");
const warehouseService = require("../services/warehouse.service");
const { NotFoundError, ValidationError, ForbiddenError } = require("../utils/errors");

const resolveTenantId = (req) => {
  if (req.tenant?._id) return req.tenant._id;
  if (req.user?.tenant) {
    const t = req.user.tenant;
    return typeof t === "object" && t._id ? t._id : t;
  }
  throw new ForbiddenError("Tenant context required");
};

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
          if (item.sizeId && !enriched.sizeName) {
            const sz = await Size.findOne({ _id: item.sizeId }).lean();
            if (sz) enriched.sizeName = sz.size;
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
  } = req.body;

  if (!sourceWarehouse || !destinationWarehouse)
    throw new ValidationError("Source and destination warehouses are required");
  if (String(sourceWarehouse) === String(destinationWarehouse))
    throw new ValidationError("Source and destination must be different warehouses");
  if (!items?.length)
    throw new ValidationError("At least one item is required");

  const enriched = await enrichItems(items, tenantId);
  const transferNumber = await generateTransferNumber(tenantId);

  const transfer = await StockTransfer.create({
    tenant: tenantId,
    transferNumber,
    sourceWarehouse,
    destinationWarehouse,
    items: enriched.map((it) => ({
      ...it,
      subProductName: it.subProductName ?? it.productName ?? "",
      transferredQty: 0,
    })),
    notes,
    scheduledDate,
    status: status === "confirmed" ? "confirmed" : "draft",
    currency: currency || "NGN",
    createdBy: userId,
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
      .populate("sourceWarehouse", "name code type")
      .populate("destinationWarehouse", "name code type")
      .populate("createdBy", "name")
      .populate("confirmedBy", "name")
      .populate("completedBy", "name")
      .populate("cancelledBy", "name")
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

  const statsMap = { draft: 0, confirmed: 0, completed: 0, cancelled: 0 };
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
    .populate("sourceWarehouse", "name code type")
    .populate("destinationWarehouse", "name code type")
    .populate("createdBy", "name")
    .populate("confirmedBy", "name")
    .populate("completedBy", "name")
    .populate("cancelledBy", "name")
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

  const { sourceWarehouse, destinationWarehouse, items, notes, scheduledDate, currency } =
    req.body;

  if (sourceWarehouse) transfer.sourceWarehouse = sourceWarehouse;
  if (destinationWarehouse) transfer.destinationWarehouse = destinationWarehouse;
  if (notes !== undefined) transfer.notes = notes;
  if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
  if (currency) transfer.currency = currency;
  if (items) {
    const enriched = await enrichItems(items, tenantId);
    transfer.items = enriched.map((it) => ({
      ...it,
      subProductName: it.subProductName ?? it.productName ?? "",
      transferredQty: 0,
    }));
  }

  if (
    String(transfer.sourceWarehouse) === String(transfer.destinationWarehouse)
  )
    throw new ValidationError("Source and destination must be different warehouses");

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

  const TRANSITIONS = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (!TRANSITIONS[transfer.status]?.includes(status)) {
    throw new ValidationError(
      `Cannot transition from '${transfer.status}' to '${status}'`
    );
  }

  const WarehouseStock = require("../models/WarehouseStock");
  const WarehouseMovement = require("../models/WarehouseMovement");
  const { recalcSubProductStock } = require("../services/warehouseStock.helpers");

  if (status === "confirmed") {
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
    transfer.confirmedBy = userId;
    transfer.confirmedAt = new Date();
  }

  if (status === "completed") {
    for (const item of transfer.items) {
      const srcId = transfer.sourceWarehouse;
      const dstId = transfer.destinationWarehouse;
      const qty = item.quantity;
      const subId = item.subProductId;
      const szId = item.sizeId;

      const srcQ = { tenant: tenantId, warehouse: srcId, subProduct: subId };
      if (szId) srcQ.size = szId;
      const src = await WarehouseStock.findOne(srcQ);
      if (!src || src.currentQuantity < qty) {
        throw new ValidationError(
          `Insufficient stock for "${item.subProductName}"${item.sizeName ? ` (${item.sizeName})` : ""}`
        );
      }
      src.currentQuantity -= qty;
      await src.save();

      const dstQ = { tenant: tenantId, warehouse: dstId, subProduct: subId };
      if (szId) dstQ.size = szId;
      let dst = await WarehouseStock.findOne(dstQ);
      if (!dst) {
        dst = new WarehouseStock({
          tenant: tenantId,
          warehouse: dstId,
          subProduct: subId,
          size: szId || src.size,
        });
      }
      dst.currentQuantity += qty;
      await dst.save();

      await WarehouseMovement.create([
        { tenant: tenantId, warehouse: srcId, subProduct: subId, size: src.size, type: 'transfer_out',
          quantity: qty, balanceAfter: src.currentQuantity, reference: `Transfer ${transfer.transferNumber}`, performedBy: userId },
        { tenant: tenantId, warehouse: dstId, subProduct: subId, size: dst.size, type: 'transfer_in',
          quantity: qty, balanceAfter: dst.currentQuantity, reference: `Transfer ${transfer.transferNumber}`, performedBy: userId },
      ]);

      await recalcSubProductStock(subId);
      item.transferredQty = qty;
    }
    transfer.completedDate = new Date();
    transfer.completedBy = userId;
  }

  if (status === "cancelled") {
    transfer.cancelledBy = userId;
    transfer.cancelledAt = new Date();
  }

  transfer.status = status;
  await transfer.save();

  res.json({ success: true, data: transfer });
});

module.exports = {
  createStockTransfer,
  getStockTransfers,
  getStockTransfer,
  updateStockTransfer,
  deleteStockTransfer,
  updateStockTransferStatus,
};
