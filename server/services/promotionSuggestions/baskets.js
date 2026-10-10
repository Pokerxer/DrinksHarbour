const id = (v) => String(v?._id || v || "");
function basketAliases(sales) {
  const aliases = new Map();
  for (const sale of sales)
    if (id(sale._id)) aliases.set(id(sale._id), `sales:${id(sale._id)}`);
  for (const sale of sales)
    if (id(sale.convertedFrom))
      aliases.set(id(sale.convertedFrom), `sales:${id(sale._id)}`);
  for (const [key, value] of aliases) {
    let next = value;
    const seen = new Set([key]);
    while (
      aliases.has(next.slice(6)) &&
      aliases.get(next.slice(6)) !== next &&
      !seen.has(next.slice(6))
    ) {
      seen.add(next.slice(6));
      next = aliases.get(next.slice(6));
    }
    aliases.set(key, next);
  }
  return aliases;
}
function orderBasketId(order, aliases) {
  return aliases.get(id(order.linkedSalesOrder)) || `order:${id(order._id)}`;
}
function groupBaskets(rows, allowed, start, end, warehouseId = "") {
  const groups = new Map();
  for (const row of rows) {
    const at = Date.parse(row.at),
      key = `${row.subProductId}:${row.sizeId}`;
    if (
      !row.basketId ||
      !allowed.has(key) ||
      row.units <= 0 ||
      !Number.isFinite(at) ||
      at < +start ||
      at >= +end ||
      (warehouseId && row.warehouseId !== warehouseId)
    )
      continue;
    const keys = groups.get(row.basketId) || new Set();
    keys.add(key);
    groups.set(row.basketId, keys);
  }
  return [...groups]
    .filter(([, keys]) => keys.size <= 50)
    .map(([id, keys]) => ({ id, keys: [...keys] }));
}
module.exports = { basketAliases, orderBasketId, groupBaskets };
