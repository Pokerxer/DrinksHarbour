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
  const existing = await StockTransfer.find({
    tenant: tenantId,
    transferNumber: /^TRF-\d+$/,
  })
    .select("transferNumber")
    .lean();
  const max = existing.reduce((m, t) => {
    const n = parseInt(String(t.transferNumber).split("-")[1], 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `TRF-${String(max + 1).padStart(6, "0")}`;
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
  const [transfers, total] = await Promise.all([
    StockTransfer.find(query)
      .populate("sourceWarehouse", "name code type")
      .populate("destinationWarehouse", "name code type")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    StockTransfer.countDocuments(query),
  ]);

  res.json({ success: true, data: transfers, total, page: Number(page) });
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

  const { sourceWarehouse, destinationWarehouse, items, notes, scheduledDate } =
    req.body;

  if (sourceWarehouse) transfer.sourceWarehouse = sourceWarehouse;
  if (destinationWarehouse) transfer.destinationWarehouse = destinationWarehouse;
  if (notes !== undefined) transfer.notes = notes;
  if (scheduledDate !== undefined) transfer.scheduledDate = scheduledDate;
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

  if (status === "completed") {
    for (const item of transfer.items) {
      await warehouseService.transferStock(
        {
          subProduct: item.subProductId,
          size: item.sizeId,
          fromWarehouse: transfer.sourceWarehouse,
          toWarehouse: transfer.destinationWarehouse,
          quantity: item.quantity,
          notes: `Stock transfer ${transfer.transferNumber}`,
        },
        userId,
        tenantId
      );
      item.transferredQty = item.quantity;
    }
    transfer.completedDate = new Date();
    transfer.completedBy = userId;
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
