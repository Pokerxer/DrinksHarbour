'use strict';
// Pure projections; callers must supply authorised, evidence-classified rows.
// Null is incomplete. It is never evidence of zero cost or zero provider fees.
const { requireMinor, sumMinor } = require('./cost-math');
const { fail } = require('./errors');
const known = (value) => value !== null && value !== undefined;

function percent(numerator, denominator) {
  if (denominator <= 0) return null;
  const scaled = BigInt(numerator) * 10000n;
  const magnitude = scaled < 0n ? -scaled : scaled;
  const divisor = BigInt(denominator);
  const rounded =
    magnitude / divisor + ((magnitude % divisor) * 2n >= divisor ? 1n : 0n);
  const safe = requireMinor(Number(rounded), { signed: true });
  return (scaled < 0n ? -safe : safe) / 100;
}

function marginAmounts({
  netMerchandiseMinor,
  costMinor,
  commissionMinor = null,
  providerFeeMinor = null,
  variableCostMinor = 0,
}) {
  requireMinor(netMerchandiseMinor, { signed: true });
  const missingReasons = [];
  for (const [label, value] of [
    ['cost', costMinor],
    ['commission', commissionMinor],
    ['provider_fee', providerFeeMinor],
    ['variable_cost', variableCostMinor],
  ]) {
    if (known(value)) requireMinor(value, { signed: true });
    else missingReasons.push(`unknown_${label}`);
  }
  if (netMerchandiseMinor <= 0)
    missingReasons.push('nonpositive_revenue_denominator');
  if (known(costMinor) && costMinor <= 0)
    missingReasons.push('nonpositive_cost_denominator');
  const grossProfitMinor = known(costMinor)
    ? sumMinor([netMerchandiseMinor, -costMinor])
    : null;
  const complete = [
    grossProfitMinor,
    commissionMinor,
    providerFeeMinor,
    variableCostMinor,
  ].every(known);
  return {
    grossProfitMinor,
    grossMarginPct: known(grossProfitMinor)
      ? percent(grossProfitMinor, netMerchandiseMinor)
      : null,
    markupPct: known(grossProfitMinor)
      ? percent(grossProfitMinor, costMinor)
      : null,
    contributionMinor: complete
      ? sumMinor([
          grossProfitMinor,
          -commissionMinor,
          -providerFeeMinor,
          -variableCostMinor,
        ])
      : null,
    missingReasons,
  };
}

function aggregateMarginRows(rows) {
  const currencies = new Set(rows.map((row) => row.currency));
  if (
    currencies.size > 1 ||
    [...currencies].some(
      (currency) =>
        typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency),
    )
  ) {
    fail(
      'INVALID_CURRENCY',
      'Report totals require one explicit currency',
      400,
    );
  }
  const normalized = rows.map((row) => ({
    ...row,
    variableCostMinor:
      row.variableCostMinor === undefined ? 0 : row.variableCostMinor,
  }));
  const amounts = normalized.map(marginAmounts);
  const total = (field) =>
    normalized.every((row) => known(row[field]))
      ? sumMinor(normalized.map((row) => row[field]))
      : null;
  const netMerchandiseMinor = sumMinor(
    normalized.map((row) => row.netMerchandiseMinor),
  );
  const costMinor = total('costMinor');
  const commissionMinor = total('commissionMinor');
  const providerFeeMinor = total('providerFeeMinor');
  const variableCostMinor = total('variableCostMinor');
  const margins = marginAmounts({
    netMerchandiseMinor,
    costMinor,
    commissionMinor,
    providerFeeMinor,
    variableCostMinor,
  });
  const costKnownRows = normalized.filter((row) => known(row.costMinor)).length;
  const feeKnownRows = normalized.filter((row) =>
    [row.commissionMinor, row.providerFeeMinor, row.variableCostMinor].every(
      known,
    ),
  ).length;
  return {
    currency: rows.length ? rows[0].currency : null,
    netMerchandiseMinor,
    costMinor,
    commissionMinor,
    providerFeeMinor,
    variableCostMinor,
    ...margins,
    knownSubtotals: {
      costMinor: sumMinor(
        normalized
          .filter((row) => known(row.costMinor))
          .map((row) => row.costMinor),
      ),
      grossProfitMinor: sumMinor(
        amounts
          .filter((row) => known(row.grossProfitMinor))
          .map((row) => row.grossProfitMinor),
      ),
      contributionMinor: sumMinor(
        amounts
          .filter((row) => known(row.contributionMinor))
          .map((row) => row.contributionMinor),
      ),
    },
    coverage: {
      rows: rows.length,
      costKnownRows,
      feeKnownRows,
      costPct: percent(costKnownRows, rows.length),
      feePct: percent(feeKnownRows, rows.length),
    },
  };
}
module.exports = { marginAmounts, aggregateMarginRows };
