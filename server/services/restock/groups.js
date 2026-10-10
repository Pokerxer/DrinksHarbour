function buildOrderGroups(visibleLines) {
  const groups = new Map();
  for (const line of visibleLines)
    if (line.selected?.quantity > 0) {
      const o = line.selected,
        groupKey = `${o.vendorId}:${o.currency}:${line.warehouseId}`;
      const group = groups.get(groupKey) || {
        key: groupKey,
        vendorId: o.vendorId,
        vendorName: o.vendorName,
        currency: o.currency,
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseName,
        estimatedCost: 0,
        lineKeys: [],
      };
      group.estimatedCost =
        Math.round((group.estimatedCost + o.estimatedCost) * 100) / 100;
      group.lineKeys.push(line.key);
      groups.set(groupKey, group);
    }
  return [...groups.values()];
}
module.exports = { buildOrderGroups };
