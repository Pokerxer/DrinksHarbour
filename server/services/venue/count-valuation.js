'use strict';
const math = require('./cost-math');
const { originalReceipt } = require('./source-receipt');
// A count records observed stock. It cannot create a missing receipt or repair valuation.
async function valueCountLots({ tenantId, locationId, lots, mongoSession }) {
  const values = [];
  for (const lot of lots) {
    const value = lot.venueValuation;
    if (!value || !Number.isSafeInteger(value.initialQuantityScaled) ||
        value.initialQuantityScaled < 1 || !Number.isSafeInteger(value.issuedQuantityScaled) ||
        value.issuedQuantityScaled < 0 || value.issuedQuantityScaled > value.initialQuantityScaled ||
        !Number.isSafeInteger(value.initialCostMinor) || value.initialCostMinor < 0 ||
        !Number.isSafeInteger(value.issuedCostMinor) || value.issuedCostMinor < 0 ||
        !(lot.initialQuantity > 0)) return null;
    const remaining = lot.quantity * value.initialQuantityScaled / lot.initialQuantity;
    if (!Number.isSafeInteger(remaining) || remaining !== value.initialQuantityScaled - value.issuedQuantityScaled)
      return null;
    const issued = value.issuedQuantityScaled === 0 ? 0 : math.allocateSourceCost({ costMinor:value.initialCostMinor,
      quantityScaled:value.initialQuantityScaled, issuedBeforeScaled:0, issueScaled:value.issuedQuantityScaled });
    if (issued !== value.issuedCostMinor) return null;
    try { await originalReceipt({tenantId,locationId,lot,mongoSession}); }
    catch (error) {
      if (['COST_EVIDENCE_REQUIRED','INVALID_CURRENCY'].includes(error.code)) return null;
      throw error;
    }
    values.push(value.initialCostMinor - value.issuedCostMinor);
  }
  return math.sumMinor(values);
}
module.exports = { valueCountLots };
