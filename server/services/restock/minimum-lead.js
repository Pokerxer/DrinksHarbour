const { id, DAY } = require('./series');
const median = (values) => {
  const v = [...values].sort((a, b) => a - b),
    m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.ceil((v[m - 1] + v[m]) / 2);
};
function minimumLead(line, e, facts, now) {
  const routes = new Map();
  for (const h of facts.history)
    if (
      h.subProductId === line.subProductId &&
      h.sizeId === line.sizeId &&
      h.destinationWarehouseId === line.warehouseId &&
      Number.isFinite(h.transitDays)
    ) {
      const route = routes.get(h.sourceWarehouseId) || new Map();
      route.set(h.transferId, h.transitDays);
      routes.set(h.sourceWarehouseId, route);
    }
  const usual = [...routes.values()]
    .filter((r) => r.size >= 3)
    .sort((a, b) => b.size - a.size)[0];
  if (usual)
    return { days: median([...usual.values()]), source: 'transfer_history' };
  const purchases = new Map();
  for (const po of e.purchases || []) {
    if (
      !['received', 'validated'].includes(po.status) ||
      id(po.warehouse) !== line.warehouseId ||
      !(po.items || []).some(
        (i) =>
          id(i.subProductId) === line.subProductId &&
          id(i.sizeId) === line.sizeId &&
          (i.receivedQty || i.postedQty) > 0,
      )
    )
      continue;
    const start = Date.parse(po.confirmationDate || po.orderDate),
      end = Date.parse(po.fullyReceivedDate);
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end >= start &&
      end <= now.getTime() &&
      end >= now.getTime() - 180 * DAY
    )
      purchases.set(id(po), Math.max(1, Math.ceil((end - start) / DAY)));
  }
  return purchases.size >= 3
    ? { days: median([...purchases.values()]), source: 'purchase_history' }
    : { days: 7, source: 'planning_default' };
}
module.exports = { minimumLead };
