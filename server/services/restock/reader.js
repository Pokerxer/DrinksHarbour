const { validateDateRange } = require("../../utils/notificationDateRange");
const { getSalesEvidence } = require("../tenantProductInsights.sales");
const { getStockSnapshots } = require("../tenantProductInsights.stock");
const { activeWindowFilter } = require("../../utils/pricelistWindow");
const { dayStart, DAY, id } = require("./series");
const { ValidationError, AppError } = require("../../utils/errors");
async function bounded(query, limit = 20000) {
  // Populate once for the bounded batch, rather than once per cursor document.
  const rows = await query
    .limit(limit + 1)
    .maxTimeMS(30000)
    .lean();
  if (rows.length > limit)
    throw new AppError(
      "Planning data exceeds safe capacity; narrow the product scope.",
      422,
    );
  return rows;
}
async function readEvidence(
  tenantId,
  {
    now = new Date(),
    warehouseId = "",
    purchasing = false,
    includeSales = true,
    baskets = false,
    startDate,
    endDate,
  } = {},
) {
  const SubProduct = require("../../models/SubProduct"),
    Warehouse = require("../../models/Warehouse");
  require("../../models/Product");
  require("../../models/Vendor");
  const products = await bounded(
    SubProduct.find({
      tenant: tenantId,
      status: { $nin: ["archived", "discontinued", "deleted"] },
    })
      .select(
        "product name sku imagesOverride lowStockThreshold reorderPoint reorderQuantity availableStock",
      )
      .populate("product", "name images"),
    5000,
  );
  const warehouses = await bounded(
    Warehouse.find({ tenant: tenantId, isActive: true }).select("name"),
    1000,
  );
  if (warehouseId && !warehouses.some((w) => id(w) === warehouseId))
    throw new ValidationError("Warehouse is unavailable for this tenant");
  const ids = products.map((p) => p._id),
    end = dayStart(now),
    range = validateDateRange({ startDate, endDate }, now, true),
    start = new Date(
      Math.min(end.getTime() - 180 * DAY, range ? +range.previous : Infinity),
    );
  if (!ids.length)
    return {
      tenantId,
      products,
      warehouses,
      snapshots: new Map(),
      sales: { rows: [], uncertain: new Set() },
      purchases: [],
      transfers: [],
      pricelists: [],
    };
  const Tenant = require("../../models/Tenant"),
    WarehouseMovement = require("../../models/WarehouseMovement");
  const PurchaseOrder = require("../../models/PurchaseOrder"),
    StockTransfer = require("../../models/StockTransfer");
  const [snapshots, sales, purchases, transfers, transferMovements, tenant] =
    await Promise.all([
      getStockSnapshots(tenantId, products, { now }),
      includeSales
        ? getSalesEvidence(
            tenantId,
            ids,
            { monthStart: start, end },
            { locations: true, baskets },
          )
        : Promise.resolve({ rows: [], uncertain: new Set() }),
      includeSales
        ? bounded(
            PurchaseOrder.find({
              tenant: tenantId,
              type: "po",
              status: { $nin: ["draft", "cancelled"] },
              $or: [
                { orderDate: { $gte: start } },
                {
                  status: {
                    $in: ["confirmed", "partially_received", "received"],
                  },
                },
              ],
            }).select(
              "vendor poNumber warehouse type status expectedArrival orderDate confirmationDate fullyReceivedDate items.subProductId items.sizeId items.quantity items.receivedQty items.postedQty items.returnedQty receipts",
            ),
          )
        : Promise.resolve([]),
      bounded(
        StockTransfer.find({
          tenant: tenantId,
          $or: [
            {
              status: {
                $in: [
                  "confirmed",
                  "in_transit",
                  "partially_received",
                  "pending_approval",
                ],
              },
            },
            { status: "completed", completedDate: { $gte: start, $lte: now } },
            { "receipts.receivedAt": { $gte: start, $lte: now } },
          ],
        }).select(
          "tenant sourceWarehouse destinationWarehouse status transferNumber scheduledDate dispatchedAt completedDate receipts items.subProductId items.sizeId items.quantity items.transferredQty items.receivedQty items.shortfallQty items.returnedQty",
        ),
      ),
      bounded(
        WarehouseMovement.find({
          tenant: tenantId,
          type: { $in: ["transfer_in", "transfer_out"] },
          createdAt: { $gte: start, $lte: now },
        }).select(
          "tenant warehouse subProduct size type quantity createdAt reference transferGroupId parentMovement",
        ),
      ),
      Tenant.findOne({ _id: tenantId })
        .select(
          "warehouseSettings.allowInterWarehouseTransfers purchaseSettings.defaultCurrency",
        )
        .lean(),
    ]);
  const validLocations = new Set(warehouses.map(id)),
    validProducts = new Set(ids.map(id));
  const Size = require("../../models/Size");
  const sizes = await bounded(
    Size.find({ tenant: tenantId, subproduct: { $in: ids } }).select(
      "subproduct displayName size",
    ),
    20000,
  );
  const validSizes = new Map(sizes.map((s) => [id(s), s]));
  sales.rows = sales.rows
    .filter((r) => validProducts.has(r.subProductId))
    .map((r) => {
      if (
        r.sizeId &&
        id(validSizes.get(r.sizeId)?.subproduct) !== r.subProductId
      )
        sales.uncertain.add(r.subProductId);
      return {
        ...r,
        warehouseId: validLocations.has(r.warehouseId) ? r.warehouseId : "",
      };
    });
  for (const snapshot of snapshots.values())
    snapshot.stock = snapshot.stock.filter(
      (r) => !r.warehouseId || validLocations.has(r.warehouseId),
    );
  let pricelists = [],
    currency = "NGN";
  if (purchasing) {
    const VendorPricelist = require("../../models/VendorPricelist");
    const lists = await bounded(
      VendorPricelist.find({
        tenant: tenantId,
        isActive: true,
        ...activeWindowFilter(now),
      }).populate({
        path: "vendor",
        match: { tenant: tenantId, isActive: true },
        select: "name tenant isActive",
      }),
      2000,
    );
    pricelists = lists;
    currency = tenant?.purchaseSettings?.defaultCurrency || "NGN";
  }
  return {
    tenantId,
    salesIncluded: includeSales,
    products,
    warehouses,
    snapshots,
    sales,
    purchases,
    transfers: transfers.map((t) => ({
      ...t,
      items: t.items
        .map((item, receiptItemIndex) => ({ ...item, receiptItemIndex }))
        .filter(
          (i) =>
            validProducts.has(id(i.subProductId)) &&
            id(validSizes.get(id(i.sizeId))?.subproduct) === id(i.subProductId),
        ),
    })),
    transferMovements: transferMovements.filter(
      (m) =>
        validProducts.has(id(m.subProduct)) &&
        id(validSizes.get(id(m.size))?.subproduct) === id(m.subProduct),
    ),
    allowTransfers:
      tenant?.warehouseSettings?.allowInterWarehouseTransfers !== false,
    pricelists,
    currency,
  };
}
module.exports = { readEvidence, bounded };
