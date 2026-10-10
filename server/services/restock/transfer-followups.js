const { id, DAY } = require('./series');
function transferFollowups(lines, e, facts, now) {
  const describe = (p) => {
    const source = lines.find(
      (s) =>
        s.warehouseId === p.sourceWarehouseId &&
        s.subProductId === p.subProductId &&
        s.sizeId === p.sizeId,
    );
    const sourceShortfallUnits =
      source && Number.isFinite(source.available)
        ? Math.max(0, source.transferPlan.outboundUnits - source.available)
        : null;
    const history = facts.history.filter(
      (h) =>
        h.subProductId === p.subProductId &&
        h.sizeId === p.sizeId &&
        h.sourceWarehouseId === p.sourceWarehouseId &&
        h.destinationWarehouseId === p.destinationWarehouseId,
    );
    const times = history
      .map((h) => h.transitDays)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const typical =
      new Set(history.map((h) => h.transferId)).size >= 3 && times.length >= 3
        ? times[Math.floor(times.length / 2)]
        : null;
    const elapsed = (now.getTime() - Date.parse(p.dispatchedAt)) / DAY;
    const followUpReason =
      p.status === 'pending_approval'
        ? 'Approval needed'
        : sourceShortfallUnits > 0
          ? 'Source stock cannot cover all committed transfers; review allocation'
          : p.status === 'confirmed' && sourceShortfallUnits === null
            ? 'Source stock is unknown; verify before dispatch'
            : p.status === 'confirmed'
              ? 'Awaiting dispatch'
              : typical !== null && elapsed > typical
                ? 'Taking longer than the usual recorded transit time'
                : 'Confirm arrival and record receipt';
    return {
      ...p,
      sourceShortfallUnits,
      followUpReason,
      sourceWarehouseName:
        e.warehouses.find((w) => id(w) === p.sourceWarehouseId)?.name ||
        'Source warehouse',
      destinationWarehouseName:
        e.warehouses.find((w) => id(w) === p.destinationWarehouseId)?.name ||
        'Destination warehouse',
    };
  };
  const described = facts.pending.map(describe);
  for (const line of lines) {
    const matching = described.filter(
      (p) => p.subProductId === line.subProductId && p.sizeId === line.sizeId,
    );
    line.transferPlan.pending = matching.filter(
      (p) => p.destinationWarehouseId === line.warehouseId,
    );
    line.transferPlan.outgoing = matching.filter(
      (p) => p.sourceWarehouseId === line.warehouseId,
    );
  }
}
module.exports = { transferFollowups };
