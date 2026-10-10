const outgoing = new Set(['shipped', 'transfer_out', 'return_out']);
function movementMetrics(row) {
  const stockChange = Number.isFinite(row.stockChange)
    ? row.stockChange
    : Number.isFinite(row.balanceBefore) && Number.isFinite(row.balanceAfter)
      ? row.balanceAfter - row.balanceBefore
      : row.type === 'adjusted'
        ? null
        : outgoing.has(row.type)
          ? -Math.abs(row.quantity || 0)
          : Math.abs(row.quantity || 0);
  return {
    stockChange,
    balanceBefore: Number.isFinite(row.balanceBefore)
      ? row.balanceBefore
      : stockChange !== null && Number.isFinite(row.balanceAfter)
        ? row.balanceAfter - stockChange
        : null,
  };
}
function summarizeMovements(rows) {
  const result = {
    incomingQuantity: 0,
    outgoingQuantity: 0,
    netQuantity: 0,
    records: rows.length,
    unknownChanges: 0,
  };
  for (const row of rows) {
    const { stockChange } = movementMetrics(row);
    if (stockChange === null) {
      result.unknownChanges++;
      continue;
    }
    if (stockChange > 0) result.incomingQuantity += stockChange;
    if (stockChange < 0) result.outgoingQuantity -= stockChange;
    result.netQuantity += stockChange;
  }
  return result;
}
module.exports = { movementMetrics, summarizeMovements };
