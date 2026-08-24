// services/tax.helpers.js
//
// Pure tax math — no Mongoose. Everything the capture service and summary
// endpoint compute lives here so it can be tested without a database.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Group document lines by their snapshot tax rate. Lines with no positive
 * base contribute nothing but still collapse into their rate bucket when
 * paired with other lines of the same rate.
 */
function groupLinesByRate(lines) {
  const byRate = new Map();
  for (const line of lines || []) {
    const rate = Math.max(0, Number(line?.taxRate) || 0);
    const base = Math.max(0, round2(line?.taxableBase));
    const bucket = byRate.get(rate) || { taxRate: rate, taxableBase: 0 };
    bucket.taxableBase = round2(bucket.taxableBase + base);
    byRate.set(rate, bucket);
  }
  return [...byRate.values()]
    .sort((a, b) => a.taxRate - b.taxRate)
    .map((g) => ({ ...g, taxAmount: round2((g.taxableBase * g.taxRate) / 100) }));
}

/** Find the tenant's active configured tax matching a document's rate snapshot. */
function matchTaxByRate(taxes, rate, type) {
  const matches = (taxes || []).filter(
    (t) =>
      t.isActive &&
      t.type === type &&
      Math.abs((Number(t.rate) || 0) - (Number(rate) || 0)) < 0.001
  );
  return matches.find((t) => t.isDefault) || matches[0] || null;
}

/** Aggregate posted records into the summary payload for the UI cards/table. */
function buildSummary(records) {
  let collected = 0;
  let paid = 0;
  let internal = 0;
  const perTax = new Map();
  for (const r of records || []) {
    if (r.status !== 'posted') continue;
    const amount = Math.max(0, Number(r.taxAmount) || 0);
    if (r.direction === 'collected') collected += amount;
    else if (r.direction === 'paid') paid += amount;
    else internal += amount;
    const key = `${r.taxName}|${r.taxRate}`;
    const row =
      perTax.get(key) || { taxName: r.taxName, taxRate: r.taxRate, collected: 0, paid: 0 };
    if (r.direction === 'collected') row.collected = round2(row.collected + amount);
    else if (r.direction === 'paid') row.paid = round2(row.paid + amount);
    perTax.set(key, row);
  }
  return {
    collected: round2(collected),
    paid: round2(paid),
    internal: round2(internal),
    netPayable: round2(collected - paid),
    byTax: [...perTax.values()],
  };
}

module.exports = { round2, groupLinesByRate, matchTaxByRate, buildSummary };
