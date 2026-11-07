'use strict';
const { fail } = require('./errors');
const math = require('./cost-math');

// Batch.quantity excludes reservations. Issued cost advances only at settlement.
// All three quantities must reconcile before another sale can claim actual cost.
async function assertSealedValuation({ tenantId, locationId, lot,
  pendingQuantity = 0, mongoSession }) {
  const value = lot.venueValuation;
  const issued = value.issuedQuantityScaled;
  if (!Number.isSafeInteger(issued) || issued < 0 || issued > value.initialQuantityScaled ||
      !Number.isSafeInteger(value.issuedCostMinor) || value.issuedCostMinor < 0 ||
      !Number.isSafeInteger(lot.quantity) || lot.quantity < 0) {
    fail('COST_REVIEW_REQUIRED', 'Sealed lot valuation watermark requires review');
  }
  const expectedCost = issued === 0 ? 0 : math.allocateSourceCost({
    costMinor: value.initialCostMinor, quantityScaled: value.initialQuantityScaled,
    issuedBeforeScaled: 0, issueScaled: issued,
  });
  if (expectedCost !== value.issuedCostMinor)
    fail('COST_REVIEW_REQUIRED', 'Sealed lot issued cost differs from original receipt');
  const reservations = await require('../../models/VenueStockEffect').find({
    tenant: tenantId, location: locationId, subproduct: lot.subProduct, size: lot.size,
    state: 'reserved', 'batchAllocations.batch': lot._id,
  }).select('batchAllocations').session(mongoSession).lean();
  const quantities = reservations.flatMap(effect => effect.batchAllocations
    .filter(row => String(row.batch) === String(lot._id)).map(row => row.quantity));
  if (quantities.some(quantity => !Number.isSafeInteger(quantity) || quantity < 1))
    fail('COST_REVIEW_REQUIRED', 'Sealed lot reservation quantity requires review');
  // The preview runs after batch depletion and before its effect is inserted.
  quantities.push(pendingQuantity);
  const accounted = math.sumMinor([lot.quantity, issued, ...quantities]);
  if (accounted !== value.initialQuantityScaled)
    fail('COST_REVIEW_REQUIRED', 'Sealed lot quantity lacks complete original cost coverage');
}
module.exports = { assertSealedValuation };
