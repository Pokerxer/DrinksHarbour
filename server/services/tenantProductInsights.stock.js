const { freshMinimum } = require('./restock/minimum');
const { known } = require('./tenantProductInsights.rules');
const id = (v) => String(v?._id || v || '');
function normalizeStock(sp, ledger, sizes, now = new Date()) {
  const threshold = (value) =>
    known(value)
      ? value
      : known(sp.lowStockThreshold)
        ? sp.lowStockThreshold
        : 10;
  const available = (onHand, reserved = 0) =>
    known(onHand) && known(reserved) ? Math.max(0, onHand - reserved) : null;
  let stock;
  if (ledger.length)
    stock = ledger.map((r) => ({
      warehouseId: id(r.warehouse),
      sizeId: id(r.size),
      warehouseName: r.warehouse?.name,
      sizeName: r.size?.displayName || r.size?.size,
      available: r.invalidReference
        ? null
        : available(r.currentQuantity, r.reservedQuantity),
      stockRecordId: r.invalidReference ? undefined : id(r),
      automaticMinimum: r.automaticMinimum,
      configuredThreshold: threshold(
        known(r.minStockLevel) && r.minStockLevel > 0
          ? r.minStockLevel
          : sp.lowStockThreshold,
      ),
      threshold:
        freshMinimum(r.automaticMinimum, now)?.units ??
        threshold(
          known(r.minStockLevel) && r.minStockLevel > 0
            ? r.minStockLevel
            : sp.lowStockThreshold,
        ),
    }));
  else if (sizes.length)
    stock = sizes.map((r) => ({
      sizeId: id(r),
      sizeName: r.displayName || r.size,
      available: available(r.stock, r.reservedStock),
      threshold: threshold(r.lowStockThreshold),
    }));
  else
    stock = [
      {
        available: known(sp.availableStock) ? sp.availableStock : null,
        threshold: threshold(sp.lowStockThreshold),
      },
    ];
  const totalAvailable = stock.every((r) => known(r.available))
    ? stock.reduce((n, r) => n + r.available, 0)
    : null;
  return { stock, totalAvailable };
}
async function getStockSnapshots(
  tenantId,
  products,
  { now = new Date() } = {},
) {
  const WarehouseStock = require('../models/WarehouseStock');
  const Size = require('../models/Size');
  require('../models/Warehouse');
  const ids = products.map((p) => p._id);
  const [ledger, sizes] = await Promise.all([
    WarehouseStock.find({ tenant: tenantId, subProduct: { $in: ids } })
      .select(
        'subProduct warehouse size currentQuantity reservedQuantity minStockLevel +automaticMinimum',
      )
      .populate({
        path: 'warehouse',
        match: { tenant: tenantId },
        select: 'name',
      })
      .populate({
        path: 'size',
        match: { tenant: tenantId, subproduct: { $in: ids } },
        select: 'size displayName subproduct',
      })
      .lean(),
    Size.find({ tenant: tenantId, subproduct: { $in: ids } })
      .select(
        'subproduct stock reservedStock size displayName lowStockThreshold',
      )
      .lean(),
  ]);
  return new Map(
    products.map((sp) => [
      id(sp),
      normalizeStock(
        sp,
        ledger
          .filter((r) => id(r.subProduct) === id(sp))
          .map((r) => ({
            ...r,
            invalidReference:
              !r.warehouse || !r.size || id(r.size.subproduct) !== id(sp),
          })),
        sizes.filter((r) => id(r.subproduct) === id(sp)),
        now,
      ),
    ]),
  );
}
module.exports = { normalizeStock, getStockSnapshots };
