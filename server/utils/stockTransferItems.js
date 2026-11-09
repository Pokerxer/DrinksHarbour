// utils/stockTransferItems.js
//
// Shared normalisation for stock-transfer line payloads coming from the
// create/edit form. Lines are discriminated by `lineType`:
//   'product'  — a catalog-linked transfer line (moves stock)
//   'section'  — a titled heading with no qty/price (form "Add a section")
//   'note'     — standalone free-text (form "Add a note")
// Product lines keep the exact legacy shape; presentation lines are neutralised
// so they can never affect dispatch, receiving, shortfalls, returns or money
// (they always quantity to 0).

const { ValidationError } = require('./errors');

const PRESENTATION_FIELD = { section: 'name', note: 'description' };

function lineTypeOf(item) {
  return item && item.lineType && item.lineType !== 'product'
    ? item.lineType
    : 'product';
}

/**
 * Normalise the wire payload of a transfer's items array in place (creates +
 * updates). Throws ValidationError for malformed lines. Returns the same
 * array reference (mutated).
 */
function sanitizeStockTransferLines(items) {
  if (!Array.isArray(items)) {
    throw new ValidationError("At least one item is required");
  }
  if (items.some((item) => !item)) {
    throw new ValidationError("Each item must be an object");
  }

  for (const item of items) {
    const type = lineTypeOf(item);
    if (type === 'product') {
      if (!item.subProductId) {
        throw new ValidationError("Each item must have subProductId");
      }
      if (!(Number(item.quantity) > 0)) {
        throw new ValidationError(
          `Quantity for "${item.subProductName || item.productName || 'a line'}" must be at least 1`
        );
      }
      if (!item.subProductName && item.productName) {
        item.subProductName = item.productName;
      }
      continue;
    }

    const field = PRESENTATION_FIELD[type];
    if (!field || !String(item[field] || '').trim()) {
      throw new ValidationError(
        `${type === 'section' ? 'Section lines' : 'Note lines'} require a ${
          field ?? 'valid lineType'
        }`
      );
    }
    // Presentation lines move no stock and carry no money of their own.
    delete item.subProductId;
    delete item.sizeId;
    item.quantity = 0;
    item.costPrice = 0;
    item.discountRate = 0;
    item.taxRate = 0;
    item.packSize = 1;
    item.lineType = type;
  }
  return items;
}

module.exports = { sanitizeStockTransferLines, lineTypeOf, PRESENTATION_FIELD };
