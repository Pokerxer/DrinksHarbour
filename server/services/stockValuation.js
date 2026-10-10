// Report carrying values separately from the next FIFO issue price.
const finite = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
function stockValuation(batches, method, quantity, standardCost = 0) {
  const units = finite(quantity);
  const fallback = Math.max(0, finite(standardCost));
  const lots = (Array.isArray(batches) ? batches : [])
    .filter((b) => finite(b.quantity) > 0)
    .map((b) => ({
      quantity: finite(b.quantity),
      cost: Math.max(0, finite(b.unitCost)),
      date: finite(new Date(b.receivedDate || 0).getTime()),
    }))
    .sort((a, b) => a.date - b.date);
  const batchUnits = lots.reduce((sum, b) => sum + b.quantity, 0);
  let value = 0,
    estimated = 0,
    unpriced = 0,
    captured = 0;
  const add = (qty, cost) => {
    value += qty * (cost > 0 ? cost : fallback);
    if (cost > 0) captured += qty;
    else {
      estimated += qty;
      if (!fallback) unpriced += qty;
    }
  };
  if (units <= 0 || !['fifo', 'average'].includes(method)) {
    value = units * fallback;
    estimated = Math.abs(units);
    unpriced = fallback ? 0 : estimated;
  } else if (method === 'average' && batchUnits > 0) {
    const covered = Math.min(units, batchUnits);
    lots.forEach((b) => add((covered * b.quantity) / batchUnits, b.cost));
    if (units > covered) add(units - covered, 0);
  } else {
    let remaining = units;
    for (const lot of lots) {
      const used = Math.min(remaining, lot.quantity);
      if (used > 0) add(used, lot.cost);
      remaining -= used;
      if (remaining <= 0) break;
    }
    if (remaining > 0) add(remaining, 0);
  }
  return {
    stockValue: finite(value),
    valuationUnitCost: units ? finite(value / units) : fallback,
    valuationSource:
      unpriced > 0 && !captured
        ? 'unpriced'
        : estimated > 0
          ? captured > 0
            ? 'mixed'
            : 'standard'
          : 'batches',
    estimatedQuantity: estimated,
    unpricedQuantity: unpriced,
    batchQuantityMismatch: units > 0 && batchUnits > 0 && Math.abs(batchUnits - units) > 1e-6,
  };
}
module.exports = { stockValuation };
