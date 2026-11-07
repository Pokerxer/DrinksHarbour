"use strict";
// Recorded-FX currency rule (workstream P). Per the strategy's FX rules: a
// converted amount is only ever produced FROM the recorded source fields —
// the policy's recorded FX source name + timestamp policy + maximum age +
// rounding — and every converted amount is bound to a snapshot of the exact
// rate used (rate id, rate, effective date, recorded source). The rate of
// record is the platform's existing ExchangeRate collection (operator-
// recorded rows); no rate is ever computed, fetched or invented here.
const ExchangeRate = require("../../../models/ExchangeRate");
const { ConflictError } = require("../../../utils/errors");

async function snapshot(statementCurrency, tenantId, amountMinor, policy, { now = new Date(), session } = {}) {
  if (policy.currencyMode !== "recorded_fx_conversion") return null;
  const row = await ExchangeRate.findOne({
    tenant: tenantId,
    fromCurrency: statementCurrency,
    toCurrency: policy.destinationCurrency,
    isActive: true,
    effectiveDate: { $lte: now },
  })
    .sort({ effectiveDate: -1 })
    .session(session)
    .lean();
  if (!row)
    throw new ConflictError(
      `The recorded FX source (${policy.fxSourceName}) provides no active ${policy.destinationCurrency} rate between ${statementCurrency} and ${policy.destinationCurrency}; a converted payout amount requires the recorded rate source.`,
    );
  const ageMinutes = (now.getTime() - new Date(row.effectiveDate).getTime()) / 60000;
  if (ageMinutes > policy.fxMaxAgeMinutes)
    throw new ConflictError(
      `The recorded FX source rate is older than the recorded maximum age (${policy.fxMaxAgeMinutes} minute(s)); a converted payout amount requires a fresh recorded rate.`,
    );
  const convertedMinor = Math.round(amountMinor * row.rate);
  if (!Number.isSafeInteger(convertedMinor) || convertedMinor < 0)
    throw new ConflictError(
      "The converted payout amount is not representable in the recorded currency precision; payout requires review.",
    );
  return {
    destinationCurrency: policy.destinationCurrency,
    fxSourceName: policy.fxSourceName,
    rateId: String(row._id),
    rate: row.rate,
    effectiveDate: row.effectiveDate,
    rateSource: row.source,
    timestampPolicy: policy.fxRateTimestampPolicy,
    rounding: policy.fxRounding,
    convertedMinor,
  };
}

module.exports = { snapshot };
