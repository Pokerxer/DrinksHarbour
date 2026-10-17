const { ValidationError } = require('../utils/errors');
function issuePredicate(quantity, overdraw = false) {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ValidationError('Invalid stock quantity');
  const enough = {$expr:{$gte:[{$subtract:[{$ifNull:['$currentQuantity',0]},{$ifNull:['$reservedQuantity',0]}]},quantity]}};
  return overdraw ? {$or:[{reservedQuantity:0},{reservedQuantity:{$exists:false}},enough]}
    : {currentQuantity:{$gte:quantity},...enough};
}
function protectDocument(row, before, after) {
  if (after < (row.reservedQuantity || 0)) throw new ValidationError('Stock is reserved for orders or quarantine.');
  // Mongoose adds $where to its atomic save predicate, so a hold created after
  // this document was read cannot be overwritten by a competing shipment.
  row.$where = {currentQuantity:before,$expr:{$lte:[{$ifNull:['$reservedQuantity',0]},after]}};
}
module.exports = { issuePredicate, protectDocument };
